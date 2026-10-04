"""Shared daily reports. The bucket stays private; only this API reads/writes it."""
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import quote

import requests
from flask import jsonify, request

_credential = {}


def today():
    return datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()


def storage_headers():
    if _credential.get('expires', 0) < time.time() + 60:
        response = requests.get(
            'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
            headers={'Metadata-Flavor': 'Google'}, timeout=5)
        response.raise_for_status()
        token = response.json()
        _credential.update(token=token['access_token'], expires=time.time() + token['expires_in'])
    return {'Authorization': 'Bearer ' + _credential['token']}


def read_day(date):
    bucket = os.environ['DAILY_REPORT_BUCKET']
    url = f'https://storage.googleapis.com/storage/v1/b/{bucket}/o/' + quote(f'daily/{date}.json', safe='')
    response = requests.get(url, headers=storage_headers(), timeout=12)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    generation = response.json()['generation']
    response = requests.get(url, params={'alt': 'media', 'generation': generation}, headers=storage_headers(), timeout=12)
    response.raise_for_status()
    result = response.json()
    result['revision'] = generation
    return result


def write_day(date, document, revision):
    bucket = os.environ['DAILY_REPORT_BUCKET']
    response = requests.post(f'https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o',
        params={'uploadType': 'media', 'name': f'daily/{date}.json', 'ifGenerationMatch': revision or '0'},
        headers={**storage_headers(), 'Content-Type': 'application/json'},
        data=json.dumps(document, ensure_ascii=False).encode('utf-8'), timeout=15)
    if response.status_code == 412:
        raise ValueError('다른 관리자가 먼저 수정했습니다. 창을 닫고 다시 열어 최신 내용을 확인해 주세요.')
    response.raise_for_status()
    return {**document, 'revision': response.json()['generation']}


def signature(payload):
    secret = os.environ.get('ADMIN_SESSION_SECRET', '')
    if not secret:
        raise RuntimeError('Admin authentication is not configured')
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def is_admin():
    try:
        token = request.headers.get('Authorization', '').removeprefix('Bearer ')
        expires, nonce, signed = token.split('.')
        return int(expires) > time.time() and hmac.compare_digest(signature(expires + '.' + nonce), signed)
    except (ValueError, RuntimeError):
        return False


def validate_document(data):
    if data.get('date') != today():
        raise ValueError('한국 시간 기준 오늘 날짜만 등록할 수 있습니다. 날짜를 다시 확인해 주세요.')
    rows = data.get('storeRanking')
    if not isinstance(rows, list) or len(rows) != 5:
        raise ValueError('품번과 판매수량 5개를 입력해 주세요.')
    clean = []
    for row in rows:
        code = str(row.get('code', '')).strip().upper()
        quantity = row.get('quantity')
        if not re.fullmatch(r'M[SK][A-Z][0-9][A-Z]{2}[0-9]{4}', code):
            raise ValueError('TOPTEN 품번을 확인해 주세요. 예: MSG4TS2312')
        if type(quantity) is not int or not 0 <= quantity <= 99999:
            raise ValueError('판매수량은 0 이상의 정수로 입력해 주세요.')
        clean.append({'code': code, 'quantity': quantity, 'rankConfirmed': True, 'numericConfirmed': True})
    if len({r['code'] for r in clean}) != 5:
        raise ValueError('같은 품번을 중복 입력할 수 없습니다.')
    # Preserve the administrator's printed sales-revenue ranking.
    for rank, row in enumerate(clean, 1):
        row['rank'] = rank
    target = data.get('targetAmount')
    if target is not None:
        if type(target) is not int or not 0 < target <= 100_000_000_000 or data.get('targetConfirmed') is not True:
            raise ValueError('목표금액을 확인하고 확인란을 체크해 주세요.')
    return {'id': 'shared-' + today(), 'date': today(), 'store': '우리매장', 'national': [],
            'storeRanking': clean, 'products': {}, 'createdAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
            'targetAmount': target, 'targetConfirmed': target is not None, 'shared': True}


def register_daily_routes(app):
    @app.post('/api/admin/login')
    def admin_login():
        expected = os.environ.get('ADMIN_PASSWORD_HASH', '')
        password = str((request.get_json(silent=True) or {}).get('password', ''))
        if not expected or not hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), expected):
            return jsonify({'error': '관리자 암호가 맞지 않습니다.'}), 401
        payload = str(int(time.time()) + 8 * 3600) + '.' + secrets.token_hex(12)
        return jsonify({'token': payload + '.' + signature(payload)})

    @app.get('/api/daily/<date>')
    def daily_get(date):
        if date == 'today':
            date = today()
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': '날짜가 올바르지 않습니다.'}), 400
        try:
            return jsonify({'date': date, 'report': read_day(date)}), 200, {'Cache-Control': 'no-store'}
        except Exception:
            app.logger.exception('Daily report read failed')
            return jsonify({'error': '공유 리포트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}), 503

    @app.put('/api/daily/<date>')
    def daily_put(date):
        if not is_admin():
            return jsonify({'error': '관리자 로그인이 필요합니다.'}), 401
        data = request.get_json(silent=True) or {}
        try:
            if date != data.get('date'):
                raise ValueError('저장 날짜를 확인해 주세요.')
            document = validate_document(data)
            revision = str(data.get('revision') or '0')
            if not revision.isdigit():
                raise ValueError('저장 버전을 다시 확인해 주세요.')
            return jsonify({'report': write_day(date, document, revision)})
        except ValueError as error:
            return jsonify({'error': str(error)}), 409 if '다른 관리자' in str(error) else 400
        except Exception:
            app.logger.exception('Daily report write failed')
            return jsonify({'error': '서버에 저장하지 못했습니다. 입력은 유지되니 다시 시도해 주세요.'}), 503
