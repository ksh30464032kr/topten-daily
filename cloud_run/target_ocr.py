"""Optional goal suggestion; an administrator must confirm it before publishing."""
import re

_engine = None


def model():
    global _engine
    if _engine is None:
        from paddleocr import PaddleOCR
        _engine = PaddleOCR(lang='korean', use_angle_cls=False, show_log=False)
    return _engine


def read_target(image):
    result = model().ocr(image[:max(100, int(image.shape[0] * .4)), :], cls=False)
    cells = []
    for page in result or []:
        for box, (text, confidence) in page or []:
            if confidence < .5:
                continue
            cells.append({'text': text, 'x': min(p[0] for p in box), 'y': min(p[1] for p in box),
                          'h': max(p[1] for p in box) - min(p[1] for p in box)})
    for label in cells:
        compact = re.sub(r'\s', '', label['text'])
        if '목표' not in compact or '률' in compact or '%' in compact:
            continue
        neighbors = [c for c in cells if c is not label and c['x'] >= label['x']
                     and abs(c['y'] - label['y']) < max(label['h'], c['h']) * 1.1]
        candidates = [label] + sorted(neighbors, key=lambda c: c['x'])
        for candidate in candidates:
            text = candidate['text']
            if '%' in text:
                continue
            numbers = re.findall(r'\d[\d,]*(?:\.\d+)?', text)
            if len(numbers) != 1:
                continue
            combined = label['text'] + ' ' + text
            multiplier = 10000 if '만원' in combined else 1000 if '천원' in combined else 1
            value = int(float(numbers[0].replace(',', '')) * multiplier)
            if value > 0:
                return {'targetAmount': value, 'targetHint': combined + (' · 원 단위로 추정, 반드시 확인' if multiplier == 1 else ' · 금액 확인 필요')}
    return {'targetAmount': None, 'targetHint': '목표액을 찾지 못했습니다. 직접 입력해 주세요.'}
