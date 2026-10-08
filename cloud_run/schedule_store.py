import re
import base64
import binascii
from io import BytesIO
from PIL import Image, ImageOps, UnidentifiedImageError
from datetime import datetime
from flask import jsonify, request
from daily_store import is_admin, read_day, write_day, today


def valid_date(date):
    return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', date)) and datetime.strptime(date, '%Y-%m-%d').date().isoformat() == date


def minutes(value):
    if not isinstance(value, str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
        raise ValueError('시간은 08:30 형식으로 입력해 주세요.')
    h, m = map(int, value.split(':'))
    return h * 60 + m


def validate_schedule(date, data):
    if not valid_date(date) or data.get('date') != date:
        raise ValueError('시간표 날짜를 확인해 주세요.')
    if 'photo' in data:
        photo = data['photo']
        if not isinstance(photo, str) or len(photo) > 8 * 1024 * 1024:
            raise ValueError('사진 용량을 줄여 다시 등록해 주세요.')
        try:
            header, encoded = photo.split(',', 1)
            if header not in ('data:image/jpeg;base64', 'data:image/png;base64', 'data:image/webp;base64'):
                raise ValueError()
            raw = base64.b64decode(encoded, validate=True)
            with Image.open(BytesIO(raw)) as source:
                if source.width * source.height > 24_000_000 or min(source.size) < 100:
                    raise ValueError()
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((4000, 4000))
                output = BytesIO()
                image.save(output, format='JPEG', quality=94)
            photo = 'data:image/jpeg;base64,' + base64.b64encode(output.getvalue()).decode('ascii')
        except (ValueError, OSError, binascii.Error, UnidentifiedImageError, Image.DecompressionBombError):
            raise ValueError('유효한 시간표 사진을 선택해 주세요.')
        return {'date': date, 'photo': photo, 'staff': [], 'updatedAt': datetime.now().astimezone().isoformat()}
    staff = data.get('staff')
    if not isinstance(staff, list) or not 1 <= len(staff) <= 50:
        raise ValueError('근무자를 1명 이상 입력해 주세요.')
    clean, names = [], set()
    for person in staff:
        name = str(person.get('name', '')).strip()
        if not name or len(name) > 30 or '\n' in name or name in names:
            raise ValueError('이름이 비어 있거나 중복됐습니다.')
        names.add(name)
        if person.get('off') is True:
            clean.append({'name': name, 'off': True, 'start': '', 'end': '', 'breaks': []})
            continue
        start, end = person.get('start'), person.get('end')
        a, b = minutes(start), minutes(end)
        if b <= a:
            raise ValueError('퇴근시간은 출근시간 이후여야 합니다.')
        pauses = person.get('breaks', [])
        if not isinstance(pauses, list) or len(pauses) > 5:
            raise ValueError('휴게시간은 최대 5개까지 입력할 수 있습니다.')
        breaks = []
        for pause in sorted(pauses, key=lambda p: str(p.get('start', ''))):
            x, y = minutes(pause.get('start')), minutes(pause.get('end'))
            if not a <= x < y <= b or (breaks and x < minutes(breaks[-1]['end'])):
                raise ValueError('휴게시간은 근무시간 안에 있어야 하며 서로 겹칠 수 없습니다.')
            breaks.append({'start': pause['start'], 'end': pause['end']})
        clean.append({'name': name, 'off': False, 'start': start, 'end': end, 'breaks': breaks})
    return {'date': date, 'staff': clean, 'updatedAt': datetime.now().astimezone().isoformat()}


def register_schedule_routes(app):
    @app.get('/api/schedule/<date>')
    def schedule_get(date):
        date = today() if date == 'today' else date
        try:
            if not valid_date(date):
                raise ValueError()
        except ValueError:
            return jsonify({'error': '날짜를 확인해 주세요.'}), 400
        try:
            return jsonify({'date': date, 'schedule': read_day(date, 'schedules')}), 200, {'Cache-Control': 'no-store'}
        except Exception:
            app.logger.exception('Schedule read failed')
            return jsonify({'error': '시간표를 불러오지 못했습니다.'}), 503

    @app.put('/api/schedule/<date>')
    def schedule_put(date):
        if not is_admin():
            return jsonify({'error': '관리자 로그인이 필요합니다.'}), 401
        request.max_content_length = 9 * 1024 * 1024
        data = request.get_json(silent=True) or {}
        try:
            document = validate_schedule(date, data)
            revision = str(data.get('revision') or '0')
            if not revision.isdigit():
                raise ValueError('시간표를 다시 열어 주세요.')
            return jsonify({'schedule': write_day(date, document, revision, 'schedules')})
        except ValueError as error:
            return jsonify({'error': str(error)}), 409 if '다른 관리자' in str(error) else 400
        except Exception:
            app.logger.exception('Schedule write failed')
            return jsonify({'error': '시간표 저장에 실패했습니다. 입력은 유지됩니다.'}), 503
