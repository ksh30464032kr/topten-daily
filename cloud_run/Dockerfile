FROM paddlepaddle/paddle:2.6.2

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN python -m pip install --upgrade "pip<26" "setuptools<82" wheel \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && python -c "import paddle; print('Paddle OK:', paddle.__version__); paddle.utils.run_check()" \
    && python -c "import pyclipper, scipy, skimage; print('deps OK:', pyclipper.__version__, scipy.__version__, skimage.__version__)"

COPY server.py .

RUN python -c "from paddleocr import PaddleOCR; print('PaddleOCR import OK')"

ENV PORT=8080

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 300 server:app"]
