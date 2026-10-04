FROM paddlepaddle/paddle:2.6.2

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    OMP_NUM_THREADS=2 \
    OPENBLAS_NUM_THREADS=2 \
    MKL_NUM_THREADS=2

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

COPY server.py daily_store.py schedule_store.py schedule_ocr.py target_ocr.py test_daily.py ./
RUN python -m unittest test_daily

# Instantiate the exact production model at build time. Its downloaded weights
# stay in /root/.paddleocr in the image instead of downloading on every cold start.
# Importing the app also catches duplicate Flask routes before deployment.
RUN python -c "import server; c=server.app.test_client(); assert c.get('/healthz').status_code == 200; assert c.get('/').status_code == 200; print('OCR models cached; Flask startup verified')"
RUN python -c "from target_ocr import model; model(); print('Target OCR model cached')"

ENV PORT=8080

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 1 --timeout 300 --access-logfile - server:app"]
