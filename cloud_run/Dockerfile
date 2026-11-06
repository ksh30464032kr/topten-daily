FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=8080
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py daily_store.py schedule_store.py location_store.py test_daily.py test_schedule_photo.py test_locations.py ./
RUN python -m unittest test_daily test_schedule_photo test_locations
RUN python -c "import server; c=server.app.test_client(); assert c.get('/healthz').status_code == 200; assert c.post('/ocr/report').status_code == 404"
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 60 --access-logfile - server:app"]
