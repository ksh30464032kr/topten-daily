from __future__ import annotations
import json, re, traceback, os
from collections import Counter
from typing import Any

import cv2
import numpy as np
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from paddleocr import PaddleOCR

app = Flask(__name__)
CORS(app)

print('[TOPTEN OCR] Loading OCR models. First launch can take a few minutes.', flush=True)
# English recognition is much better for TOPTEN's uppercase alphanumeric product codes.
ocr_code = PaddleOCR(lang='en', use_angle_cls=False, show_log=False)
print('[TOPTEN OCR] READY', flush=True)

KNOWN = {'CG','CB','KG','KB','KS','KP','VP','LK','LJ','WC','WD','TC','TR','TV','TT','TL','TH','TS','EC','ER','EV','ET','ES','OO','PP','PH','PT','PS','DP','DH','RL','RS','US','UT','UB','UP','UL','UG','UH','UI','AB','AL','AC','AS','AT','AM','AV','AY','EL','DS','JJ','JP','WB','LV','AF','AP','AJ','AZ'}
CODE_RE = re.compile(r'^M[SK][A-Z][0-9][A-Z]{2}[0-9]{4}$')
DATE_RE = re.compile(r'(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})')

LETTER_FROM_DIGIT = {'0':'O','1':'I','2':'Z','5':'S','6':'G','8':'B'}
DIGIT_FROM_LETTER = {'O':'0','Q':'0','D':'0','C':'0','I':'1','L':'1','T':'1','Z':'2','S':'5','G':'6','B':'8'}


def image_from_request():
    f = request.files.get('file')
    if not f:
        raise ValueError('No image file was uploaded.')
    raw = f.read()
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError('Please use an image under 25 MB.')
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('Could not read the JPG/PNG image.')
    return img, f.filename or ''


def group_lines(vals: list[int], gap=2):
    groups = []
    for v in vals:
        if groups and v - groups[-1][-1] <= gap:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [int(round(sum(g) / len(g))) for g in groups]


def table_grid(img: np.ndarray):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    dark = gray < 150
    hvals = [y for y in range(int(h * .22), h) if int(dark[y].sum()) > w * .55]
    ys0 = group_lines(hvals)
    best = []
    for i in range(max(0, len(ys0) - 2)):
        run = [ys0[i]]
        if i + 1 >= len(ys0):
            continue
        step = ys0[i + 1] - ys0[i]
        if step < 8:
            continue
        for j in range(i + 1, len(ys0)):
            d = ys0[j] - run[-1]
            if abs(d - step) <= max(3, step * .2):
                run.append(ys0[j])
            elif d > step * 1.5:
                break
        if len(run) > len(best):
            best = run
    if len(best) < 8:
        raise ValueError('Could not find the horizontal lines of the BEST table.')

    top, bottom = best[0], best[-1]
    band = dark[top:bottom + 1]
    vvals = [x for x in range(w) if int(band[:, x].sum()) > (bottom - top) * .72]
    xs = group_lines(vvals)
    if len(xs) < 9:
        raise ValueError('Could not find the vertical lines of the BEST table.')

    # On the TOPTEN report form, the local-store code column starts around 35% of width.
    candidates = [i for i in range(len(xs) - 4) if .28 <= xs[i] / w <= .48]
    if not candidates:
        raise ValueError('Could not locate the local-store section of the report.')

    def score(i):
        widths = [xs[i + 1] - xs[i], xs[i + 2] - xs[i + 1], xs[i + 3] - xs[i + 2]]
        return abs(xs[i] / w - .35) * 10 + (0 if widths[0] >= widths[1] else .7)

    si = min(candidates, key=score)
    return {
        'ys': best,
        'data_start': 2,
        'code': [xs[si], xs[si + 1]],
        'quantity': [xs[si + 1], xs[si + 2]],
        'amount': [xs[si + 2], xs[si + 3]],
    }


def crop_cell(img, rect, pad=1):
    h, w = img.shape[:2]
    x, y, rw, rh = [int(round(rect[k])) for k in ('left', 'top', 'width', 'height')]
    x0, y0 = max(0, x + pad), max(0, y + pad)
    x1, y1 = min(w, x + rw - pad), min(h, y + rh - pad)
    c = img[y0:y1, x0:x1].copy()
    if c.size == 0:
        return c
    # Remove only the cell border. Keep the entire text width so first/last letters are not clipped.
    b = 1
    c[:b, :] = 255
    c[-b:, :] = 255
    c[:, :b] = 255
    c[:, -b:] = 255
    return c


def crop_quantity_cell(img, rect):
    """Crop a quantity cell without including either vertical grid line.

    The quantity digits are right-aligned and can touch the last pixel before
    the right grid line, so do not erase the rightmost source column.
    """
    h, w = img.shape[:2]
    x = int(round(rect['left']))
    y = int(round(rect['top']))
    rw = int(round(rect['width']))
    rh = int(round(rect['height']))

    # Grid coordinates mark the vertical lines themselves.
    # Skip the left line, stop immediately BEFORE the right line.
    x0 = max(0, x + 1)
    x1 = min(w, x + rw)
    y0 = max(0, y + 1)
    y1 = min(h, y + rh)

    c = img[y0:y1, x0:x1].copy()
    if c.size == 0:
        return c

    # Do not paint over the right edge: the last glyph can occupy it.
    # Add clean white space outside the original cell instead.
    c = cv2.copyMakeBorder(
        c, 2, 2, 3, 14,
        cv2.BORDER_CONSTANT,
        value=(255, 255, 255)
    )
    return c

def _content_crop_for_number(gray: np.ndarray):
    """Tighten a numeric cell around the actual glyphs, not the whole table cell."""
    if gray.size == 0:
        return gray
    g = gray.copy()
    h, w = g.shape
    # Ignore any faint table-border remnants.
    edge = min(3, max(1, min(h, w) // 8))
    g[:edge, :] = 255
    g[-edge:, :] = 255
    g[:, :edge] = 255
    g[:, -edge:] = 255

    mask = g < 205
    ys, xs = np.where(mask)
    if len(xs) < 2:
        return gray

    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    # Keep a little source-space margin so 1/7 are not clipped.
    mx, my = 3, 2
    x0, x1 = max(0, x0 - mx), min(w, x1 + mx)
    y0, y1 = max(0, y0 - my), min(h, y1 + my)
    tight = g[y0:y1, x0:x1]
    return tight if tight.size else gray


def _add_white_margin(img: np.ndarray, x=34, y=22):
    return cv2.copyMakeBorder(img, y, y, x, x, cv2.BORDER_CONSTANT, value=255)


def variants(crop, numeric=False):
    if crop.size == 0:
        return []

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if numeric:
        gray = _content_crop_for_number(gray)

    # Small text in this report is only around 7-10 px tall.
    # Resize first, then add a large white breathing space. Paddle's recognizer
    # is much more reliable when the first/last glyph does not touch the edge.
    target_h = 128 if numeric else 116
    scale = max(6, min(18, int(np.ceil(target_h / max(1, gray.shape[0])))))

    nearest = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
    cubic = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    lanczos = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)

    # Add larger horizontal margins because product codes are left-aligned and
    # amounts are right-aligned in the cells.
    nearest = _add_white_margin(nearest, 48 if not numeric else 42, 24)
    cubic = _add_white_margin(cubic, 48 if not numeric else 42, 24)
    lanczos = _add_white_margin(lanczos, 48 if not numeric else 42, 24)

    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(lanczos)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(
        clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 7
    )

    return [
        ('nearest', nearest),
        ('cubic', cubic),
        ('otsu', otsu),
        ('adaptive', adaptive),
    ]

def flatten_rec_result(obj: Any):
    found = []
    def walk(x):
        if isinstance(x, (list, tuple)):
            if len(x) >= 2 and isinstance(x[0], str) and isinstance(x[1], (float, int)):
                found.append((x[0], float(x[1])))
            else:
                for y in x:
                    walk(y)
    walk(obj)
    return found


def recognize_single(img, engine):
    try:
        result = engine.ocr(img, det=False, cls=False)
    except TypeError:
        result = engine.ocr(img, det=False)
    pairs = flatten_rec_result(result)
    return max(pairs, key=lambda p: p[1]) if pairs else ('', 0.0)


def clean(s):
    return re.sub(r'[^A-Z0-9]', '', s.upper())


def normalize_by_position(code: str):
    if len(code) != 10:
        return code
    chars = list(code)

    letter_pos = {0, 1, 2, 4, 5}
    digit_pos = {3, 6, 7, 8, 9}

    for i in letter_pos:
        if chars[i].isdigit() and chars[i] in LETTER_FROM_DIGIT:
            chars[i] = LETTER_FROM_DIGIT[chars[i]]

    for i in digit_pos:
        if chars[i].isalpha() and chars[i] in DIGIT_FROM_LETTER:
            chars[i] = DIGIT_FROM_LETTER[chars[i]]

    # All TOPTEN style codes in this project start with M.
    # OCR frequently reads the left-edge M as V/W/N/H.
    chars[0] = 'M'

    # Second position is S or K. Apply only high-confidence visual confusions.
    if chars[1] not in {'S', 'K'}:
        if chars[1] in {'5', '8'}:
            chars[1] = 'S'
        elif chars[1] in {'X', 'R'}:
            chars[1] = 'K'

    return ''.join(chars)

def candidate_windows(s):
    s = clean(s)
    raw = []
    if len(s) == 10:
        raw.append(s)
    elif len(s) > 10:
        raw.extend(s[i:i + 10] for i in range(len(s) - 9))
    elif s:
        raw.append(s)
    out = []
    for c in raw:
        out.extend([c, normalize_by_position(c)])
    return list(dict.fromkeys(out))


def code_quality(code):
    score = 0
    if len(code) == 10:
        score += 4
    if code.startswith('M'):
        score += 3
    if len(code) > 1 and code[1] in 'SK':
        score += 3
    if CODE_RE.match(code):
        score += 14
    if len(code) >= 6 and code[4:6] in KNOWN:
        score += 10
    return score


def recognize_code(crop):
    readings, choices = [], []
    for name, img in variants(crop, numeric=False):
        text, conf = recognize_single(img, ocr_code)
        raw = clean(text)
        windows = candidate_windows(raw)
        best = max(windows, key=code_quality) if windows else raw
        readings.append({'raw': raw, 'code': best, 'confidence': round(conf * 100, 1), 'variant': name})
        choices.append((best, conf, code_quality(best)))

    if not choices:
        return {'code': '', 'confidence': 0, 'agreement': 0, 'disagreement': False, 'readings': []}

    valid = [x for x in choices if CODE_RE.match(x[0]) and x[0][4:6] in KNOWN]
    pool = valid or choices
    counts = Counter(x[0] for x in pool if x[0])
    if counts:
        code = max(counts, key=lambda c: (counts[c], max((q + conf) for cc, conf, q in pool if cc == c)))
    else:
        code = ''
    same = [x for x in choices if x[0] == code]
    confidence = round(max((x[1] for x in same), default=0) * 100, 1)
    return {
        'code': code,
        'confidence': confidence,
        'agreement': len(same),
        'disagreement': len({x[0] for x in choices if x[0]}) > 1 and len(same) < 2,
        'readings': readings,
    }


def recognize_number(crop):
    readings, votes = [], []

    for name, img in variants(crop, numeric=True):
        text, conf = recognize_single(img, ocr_code)
        raw = clean(text)

        # Paddle may return O/C/I/S etc. for tiny digits.
        mapped = ''.join(DIGIT_FROM_LETTER.get(ch, ch) for ch in raw)
        digits = re.sub(r'\D', '', mapped)

        readings.append({
            'raw': raw,
            'code': digits,
            'confidence': round(conf * 100, 1),
            'variant': name
        })
        if digits:
            votes.append((digits, conf))

    if not votes:
        return None, readings

    cnt = Counter(x[0] for x in votes)
    best = max(
        cnt,
        key=lambda c: (
            cnt[c],
            max(cf for v, cf in votes if v == c),
            len(c)
        )
    )
    return int(best), readings

def recognize_quantity(crop):
    """Specialized OCR for small sales quantity cells."""
    readings = []
    candidates = []
    if crop.size == 0:
        return None, readings

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    gray = _content_crop_for_number(gray)

    scales = [10, 14, 18]
    methods = [
        ("nearest", cv2.INTER_NEAREST),
        ("cubic", cv2.INTER_CUBIC),
        ("lanczos", cv2.INTER_LANCZOS4),
    ]

    for scale in scales:
        for name, interp in methods:
            enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=interp)
            enlarged = cv2.copyMakeBorder(
                enlarged, 55, 55, 70, 70,
                cv2.BORDER_CONSTANT, value=255
            )

            variants_local = [(f"{name}_{scale}_gray", enlarged)]
            blur = cv2.GaussianBlur(enlarged, (3, 3), 0)
            _, otsu = cv2.threshold(
                blur, 0, 255,
                cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            variants_local.append((f"{name}_{scale}_otsu", otsu))

            adaptive = cv2.adaptiveThreshold(
                enlarged, 255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2.THRESH_BINARY, 31, 7
            )
            variants_local.append((f"{name}_{scale}_adaptive", adaptive))

            for vname, img in variants_local:
                text, conf = recognize_single(img, ocr_code)
                raw = clean(text)
                mapped = ''.join(DIGIT_FROM_LETTER.get(ch, ch) for ch in raw)
                digits = re.sub(r'\D', '', mapped)

                readings.append({
                    'raw': raw,
                    'code': digits,
                    'confidence': round(conf * 100, 1),
                    'variant': vname
                })

                if digits:
                    if 1 <= len(digits) <= 2:
                        try:
                            val = int(digits)
                            if 0 <= val <= 99:
                                candidates.append((val, conf))
                        except:
                            pass
                    elif len(set(digits)) == 1:
                        candidates.append((int(digits[0]), conf * 0.95))

    if not candidates:
        return None, readings

    vote_count = Counter(v for v, _ in candidates)
    best = max(
        vote_count,
        key=lambda v: (
            vote_count[v],
            max(conf for val, conf in candidates if val == v),
            -v
        )
    )
    return int(best), readings

def metadata(img, filename):
    date, store = '', ''
    m = DATE_RE.search(filename)
    if m:
        date = f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'
    top = img[:max(100, int(img.shape[0] * .20)), :]
    try:
        result = ocr_meta.ocr(top, det=True, cls=False)
        texts = []
        def walk(x):
            if isinstance(x, (list, tuple)):
                if len(x) >= 2 and isinstance(x[0], str) and isinstance(x[1], (float, int)):
                    texts.append(x[0])
                else:
                    for y in x:
                        walk(y)
        walk(result)
        joined = ' '.join(texts)
        meta_match = DATE_RE.search(joined)
        if not date and meta_match:
            date = f'{meta_match.group(1)}-{int(meta_match.group(2)):02d}-{int(meta_match.group(3)):02d}'
        # Prefer a Korean name following the date/store-code area.
        kor = re.findall(r'[가-힣]{2,}', joined)
        ignored = {'일별판매리포트','판매','월목표','일누계매출','전년매출','전월매출','전월대비신장률'}
        for token in reversed(kor):
            if token not in ignored and len(token) <= 10:
                store = token
                break
    except Exception:
        pass
    return date, store


def rect_from_bounds(x1, x2, y1, y2):
    return {'left': int(x1), 'top': int(y1), 'width': int(x2 - x1), 'height': int(y2 - y1)}


@app.get('/')
def root():
    return '<h2>TOPTEN OCR is running.</h2><p>Open the TOPTEN website at <b>http://localhost:3000</b>.</p>'


@app.get('/health')
def health():
    return jsonify({'ok': True, 'engine': 'PaddleOCR', 'codeModel': 'en', 'metaModel': 'korean'})



@app.get('/')
def root():
    return jsonify({'ok': True, 'service': 'TOPTEN OCR API'})


@app.get('/healthz')
def healthz():
    return jsonify({'ok': True})


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


@app.post('/ocr/report')
def report():
    try:
        img, _ = image_from_request()
        grid = table_grid(img)
        ys, start = grid['ys'], grid['data_start']
        if start + 5 >= len(ys):
            raise ValueError('Could not find five local-store TOP rows.')

        rows = []
        for rank in range(1, 6):
            i = start + rank - 1
            y1, y2 = ys[i], ys[i + 1]

            # Only the two fields the app actually needs.
            cr = rect_from_bounds(*grid['code'], y1, y2)
            qr = rect_from_bounds(*grid['quantity'], y1, y2)

            code = recognize_code(crop_cell(img, cr))
            qty_crop = crop_quantity_cell(img, qr)
            qty, qreads = recognize_quantity(qty_crop)

            rows.append({
                **code,
                'rank': rank,
                'rankConfirmed': True,
                'rect': cr,
                'quantity': qty,
                'numericConfirmed': qty is not None,
                'quantityRect': qr,
                'quantityReadings': qreads,
            })

        # No date/store/amount OCR. Keep empty metadata only for Report type compatibility.
        return jsonify({
            'date': '',
            'store': '',
            'storeRanking': rows,
            'engine': 'PaddleOCR'
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


@app.post('/ocr/cell')
def cell():
    try:
        img, _ = image_from_request()
        rect = json.loads(request.form.get('rect', '{}'))
        kind = request.form.get('kind', 'code')
        crop = crop_cell(img, rect)
        if kind == 'number':
            value, readings = recognize_number(crop)
            return jsonify({'value': value, 'readings': readings, 'rect': rect})
        return jsonify({**recognize_code(crop), 'rect': rect})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8765'))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
