import re
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from daily_store import register_daily_routes
from schedule_store import register_schedule_routes
from location_store import register_location_routes
app=Flask(__name__)
CORS(app)
register_daily_routes(app)
register_schedule_routes(app)
register_location_routes(app)
@app.get('/')
@app.get('/health')
@app.get('/healthz')
def health():
    return jsonify({'ok': True, 'service': 'TOPTEN API'})

def product_search_url(code: str):
    return f'https://display-topten10.goodwearmall.com/search?keyword={code}'


@app.get('/api/products/<code>')
def product_lookup(code: str):
    code = re.sub(r'[^A-Z0-9]', '', code.upper())
    now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    fallback = {
        'code': code,
        'status': 'missing',
        'url': product_search_url(code),
        'checkedAt': now
    }
    if not (8 <= len(code) <= 15 and re.search(r'[A-Z]', code) and re.search(r'\d', code)):
        return jsonify({'error': 'invalid code'}), 400

    try:
        r = requests.get(
            'https://display-topten10.goodwearmall.com/api/search/keyword',
            params={'keyword': code, 'pageNo': 1},
            headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'},
            timeout=12
        )
        r.raise_for_status()
        body = r.json()
        docs = body.get('documents') if isinstance(body, dict) else None
        if not isinstance(docs, list):
            raise ValueError('schema changed')

        found = None
        for d in docs:
            god = d.get('GOD_NO')
            brand = d.get('BRND_ID')
            if not isinstance(god, str) or brand not in ('MSBR', 'MKBR'):
                continue
            suffix = god[len(code):] if god.startswith(code) else ''
            if god == code or (god.startswith(code) and re.fullmatch(r'[A-Z0-9]{2,3}', suffix or '') is not None):
                found = d
                break

        if not found:
            return jsonify(fallback)

        img = found.get('IMG_URL')
        if isinstance(img, str) and img.startswith('/'):
            img = 'https://img.goodwearmall.com' + img
        elif isinstance(img, str) and not img.startswith('http'):
            img = 'https://img.goodwearmall.com/' + img.lstrip('/')

        def num(v):
            try:
                return int(float(v))
            except Exception:
                return None

        out = dict(fallback)
        out.update({
            'status': 'found',
            'name': str(found.get('GOD_NM') or code),
            'normalPrice': num(found.get('CVR_PRC')),
            'price': num(found.get('LAST_SALE_PRC')),
            'image': img if isinstance(img, str) and img.startswith('https://') else None,
            'url': f"https://topten10.goodwearmall.com/product/{found.get('GOD_NO')}/detail"
        })
        return jsonify(out)
    except Exception:
        fallback['status'] = 'error'
        return jsonify(fallback)


