import base64
import unittest
from io import BytesIO
from unittest.mock import patch
from flask import Flask
from PIL import Image
import schedule_store

class SchedulePhotoTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        schedule_store.register_schedule_routes(app)
        self.client = app.test_client()
        image = BytesIO()
        Image.new('RGB', (400, 200), 'white').save(image, 'JPEG')
        self.payload = {'date': '2026-10-08', 'photo': 'data:image/jpeg;base64,' + base64.b64encode(image.getvalue()).decode(), 'revision': '17'}

    def test_requires_admin(self):
        with patch('schedule_store.is_admin', return_value=False), patch('schedule_store.write_day') as write:
            self.assertEqual(self.client.put('/api/schedule/2026-10-08', json=self.payload).status_code, 401)
            write.assert_not_called()

    def test_photo_save_and_shared_read(self):
        saved = {}
        def write(date, document, revision, prefix):
            self.assertEqual((date, revision, prefix), ('2026-10-08', '17', 'schedules'))
            saved.update(document, revision='18')
            return saved
        with patch('schedule_store.is_admin', return_value=True), patch('schedule_store.write_day', side_effect=write), patch('schedule_store.read_day', side_effect=lambda *args: saved):
            self.assertEqual(self.client.put('/api/schedule/2026-10-08', json=self.payload).status_code, 200)
            data = self.client.get('/api/schedule/2026-10-08').json['schedule']
            self.assertEqual(data['revision'], '18')
            photo = Image.open(BytesIO(base64.b64decode(data['photo'].split(',')[1])))
            self.assertEqual(photo.size, (400, 200))
            self.assertEqual(data['staff'], [])

    def test_bad_image_and_conflict(self):
        with patch('schedule_store.is_admin', return_value=True), patch('schedule_store.write_day', side_effect=ValueError('다른 관리자가 먼저 수정했습니다.')):
            self.assertEqual(self.client.put('/api/schedule/2026-10-08', json={**self.payload, 'photo': 'data:image/jpeg;base64,bad'}).status_code, 400)
            self.assertEqual(self.client.put('/api/schedule/2026-10-08', json=self.payload).status_code, 409)

if __name__ == '__main__':
    unittest.main()
