from datetime import datetime
from flask import jsonify, request
from daily_store import is_admin, read_day, write_day

def validate_locations(data):
    rows = data.get('items')
    if not isinstance(rows, list) or len(rows) > 300:
        raise ValueError('위치는 최대 300개까지 등록할 수 있습니다.')
    clean, ids = [], set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('등록 내용을 확인해 주세요.')
        item = {}
        for key, limit in [('id', 60), ('name', 80), ('aliases', 200), ('floor', 20), ('group', 20), ('location', 200)]:
            value = row.get(key, '')
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError('입력 길이를 확인해 주세요.')
            item[key] = value.strip()
        if not all(item[k] for k in ('id','name','floor','location')) or item['id'] in ids:
            raise ValueError('이름·층·위치를 입력하고 중복 항목을 확인해 주세요.')
        if item['group'] not in ('남성','여성','키즈','공용'):
            raise ValueError('상품 구분을 확인해 주세요.')
        ids.add(item['id'])
        clean.append(item)
    return {'items': clean, 'updatedAt': datetime.now().astimezone().isoformat()}

def register_location_routes(app):
    @app.get('/api/locations')
    def locations_get():
        try:
            return jsonify(read_day('catalog', 'locations') or {'items': [], 'revision': '0'}), 200, {'Cache-Control':'no-store'}
        except Exception:
            app.logger.exception('Location read failed')
            return jsonify({'error':'매장 위치를 불러오지 못했습니다.'}), 503

    @app.put('/api/locations')
    def locations_put():
        if not is_admin():
            return jsonify({'error':'관리자 로그인이 필요합니다.'}), 401
        request.max_content_length = 512 * 1024
        data = request.get_json(silent=True) or {}
        try:
            document = validate_locations(data)
            revision = str(data.get('revision') or '0')
            if not revision.isdigit():
                raise ValueError('창을 닫고 다시 열어 주세요.')
            return jsonify(write_day('catalog', document, revision, 'locations'))
        except ValueError as error:
            return jsonify({'error':str(error)}), 409 if '다른 관리자' in str(error) else 400
        except Exception:
            app.logger.exception('Location write failed')
            return jsonify({'error':'저장하지 못했습니다. 입력은 유지됩니다.'}), 503
