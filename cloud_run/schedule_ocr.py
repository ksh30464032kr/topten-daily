"""Read the supplied TOPTEN daily staffing form; return an editable draft only."""
import re
from datetime import date
import cv2
import numpy as np
from target_ocr import model


def texts(image, x0, y0, x1, y1):
    crop = image[y0:y1, x0:x1]
    scale = min(3, 1400 / max(crop.shape[:2]))
    crop = cv2.resize(crop, None, fx=scale, fy=scale)
    result = model().ocr(crop, cls=False)
    return [{'text': re.sub(r'\s+', '', text), 'confidence': float(confidence),
             'x': x0 + sum(p[0] for p in box) / 4 / scale,
             'y': y0 + sum(p[1] for p in box) / 4 / scale,
             'h': (max(p[1] for p in box)-min(p[1] for p in box))/scale}
            for page in result or [] for box, (text, confidence) in page or []]


def clock(text):
    match = re.fullmatch(r'(\d{1,2})[:.](\d{2})', text)
    if not match:
        return ''
    h, m = map(int, match.groups())
    return f'{h:02}:{m:02}' if h < 24 and m < 60 else ''


def minutes(value):
    h, m = map(int, value.split(':'))
    return h * 60 + m


def stamp(value):
    return f'{value//60:02}:{value%60:02}'


def merge_slots(slots):
    out = []
    for start, end in slots:
        if out and out[-1]['end'] == stamp(start):
            out[-1]['end'] = stamp(end)
        else:
            out.append({'start': stamp(start), 'end': stamp(end)})
    return out


def read_schedule(image, number_model=None):
    h, w = image.shape[:2]
    if w/h < 1.8 or w < 1000:
        raise ValueError('시간표 전체가 보이는 가로 원본 사진을 올려 주세요. 이름·시간·오른쪽 표가 모두 필요합니다.')
    cells = texts(image, 0, int(h*.37), int(w*.222), h)
    heading_cells = texts(image, 0, int(h*.385), int(w*.222), int(h*.409))
    headers = {label: next((c for c in heading_cells if label in c['text']), None) for label in ('이름', '출근', '퇴근')}
    if not all(headers.values()):
        raise ValueError('이름·출근·퇴근 표를 찾지 못했습니다. 보내주신 시간표와 같은 양식의 전체 원본을 사용해 주세요.')
    header = headers['출근']
    # Minute-header vertical rules locate all half-hour cells, including the
    # narrower first two columns. Do not infer break times from total duration.
    ya, yb = int(header['y']-header['h']*.65), int(header['y']+header['h']*.65)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mask = (gray[ya:yb] < 190).mean(axis=0)
    groups = []
    for x in np.flatnonzero(mask > .8):
        if x < w*.235:
            continue
        if groups and x-groups[-1][-1] <= 3:
            groups[-1].append(int(x))
        else:
            groups.append([int(x)])
    edges = [int(np.mean(g)) for g in groups]
    # Some exports draw solid hourly rules but omit half-hour rules.
    if len(edges) == 16:
        edges = [v for a, b in zip(edges, edges[1:]) for v in (a, (a+b)//2)] + [edges[-1]]
    if len(edges) == 30 and edges[-1] < w-5:
        edges.append(w-1)
    if len(edges) != 31:
        raise ValueError('30분 단위 시간 칸을 구분하지 못했습니다. 잘리지 않은 선명한 원본을 올려 주세요.')
    hours = texts(image, edges[0], int(h*.36), edges[6], ya)
    if not any(re.search(r'8시', c['text']) for c in hours):
        raise ValueError('시간축 시작(8시)을 확인하지 못했습니다. 다른 양식은 직접 입력해 주세요.')
    dates = texts(image, 0, 0, int(w*.13), int(h*.23))
    found_date = ''
    for cell in dates:
        match = re.search(r'(20\d{2})[-./년](\d{1,2})[-./월](\d{1,2})', cell['text'])
        if match:
            try:
                found_date = date(*map(int, match.groups())).isoformat()
                break
            except ValueError:
                pass
    names = sorted([c for c in cells if c['x'] < w*.045 and c['y'] > header['y']+header['h'] and re.fullmatch(r'[가-힣]{2,5}', c['text'])], key=lambda c:c['y'])
    if not names:
        raise ValueError('직원 이름을 읽지 못했습니다. 더 선명한 사진을 올리거나 직접 입력해 주세요.')
    warnings = []
    staff = []
    for name in names:
        row = [c for c in cells if abs(c['y']-name['y']) < max(name['h'], c['h'])*.8]
        def at(x):
            choices = [c for c in row if abs(c['x']/w-x) < .015]
            value = clock(min(choices, key=lambda c:abs(c['x']/w-x))['text']) if choices else ''
            if value or number_model is None:
                return value
            # Retry only unreadable time cells with the already loaded Latin
            # recognizer, avoiding a second pass over the full timetable.
            y = int(name['y'])
            radius = max(8, int(name['h']*.8))
            crop = image[max(0,y-radius):min(h,y+radius), int(w*(x-.014)):int(w*(x+.014))]
            crop = cv2.resize(crop, None, fx=3, fy=3)
            crop = cv2.copyMakeBorder(crop, 8, 8, 8, 8, cv2.BORDER_CONSTANT, value=(255,255,255))
            for item in number_model.ocr(crop, det=False, cls=False) or []:
                if not item or not isinstance(item[0], str):
                    continue
                candidate = re.sub(r'\s+', '', item[0]).replace('O','0')
                if re.fullmatch(r'\d{3,4}', candidate):
                    candidate = candidate[:-2]+':'+candidate[-2:]
                value = clock(candidate)
                if value:
                    return value
            return ''
        start, end, total = at(.113), at(.146), at(.181)
        pauses = []
        if start and end and minutes(end)>minutes(start):
            # On this form breaks have a dark neutral background with white
            # text. Sample the header band, not the gray task block beneath it.
            slots = []
            y = int(name['y'])
            for i, (left, right) in enumerate(zip(edges, edges[1:])):
                a, b = 480+i*30, 510+i*30
                if a < minutes(start) or b > minutes(end):
                    continue
                patch = image[max(0,y-int(name['h']*.45)):y+max(2,int(name['h']*.45)), left+4:right-4]
                med = np.median(patch.reshape(-1,3), axis=0)
                if 25 < med.mean() < 105 and med.max()-med.min() < 22:
                    slots.append((a,b))
            pauses = merge_slots(slots)
            duration = sum(minutes(p['end'])-minutes(p['start']) for p in pauses)
            if not total or duration != minutes(total):
                warnings.append(f"{name['text']}: 휴게 구간과 왼쪽 휴게 합계를 대조해 주세요.")
        else:
            warnings.append(f"{name['text']}: 출퇴근시간을 직접 확인해 주세요.")
        staff.append({'name':name['text'], 'start':start, 'end':end, 'off':False, 'breaks':pauses})
    if not found_date:
        warnings.append('사진 날짜를 읽지 못했습니다. 저장 날짜를 직접 확인해 주세요.')
    return {'date':found_date, 'staff':staff, 'warnings':warnings,
            'hint':'이름·날짜·출퇴근·휴게시간을 원본과 대조한 뒤 저장해 주세요. 업무 배치는 인식하지 않습니다.'}
