import hashlib
import os
import unittest
from unittest.mock import patch
from flask import Flask
import daily_store


class DailyTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ADMIN_PASSWORD_HASH=hashlib.sha256(b'test-password').hexdigest(), ADMIN_SESSION_SECRET='test-only-secret')
        self.env.start()
        app = Flask(__name__)
        daily_store.register_daily_routes(app)
        self.client = app.test_client()
        self.payload = {'date': daily_store.today(), 'storeRanking': [
            {'code': f'MSG4TS100{i}', 'quantity': i} for i in range(5)],
            'targetAmount': 1_000_000, 'targetConfirmed': True, 'revision': '0'}

    def tearDown(self):
        self.env.stop()

    def login(self):
        result = self.client.post('/api/admin/login', json={'password': 'test-password'})
        self.assertEqual(result.status_code, 200)
        return {'Authorization': 'Bearer ' + result.json['token']}

    def test_requires_admin_and_rejects_wrong_password(self):
        self.assertEqual(self.client.put('/api/daily/' + daily_store.today(), json=self.payload).status_code, 401)
        self.assertEqual(self.client.post('/api/admin/login', json={'password': 'wrong'}).status_code, 401)

    def test_save_and_other_client_read(self):
        saved = {}
        def write(date, document, revision):
            self.assertEqual(revision, '0')
            saved.update(document, revision='123')
            return saved
        with patch.object(daily_store, 'write_day', side_effect=write), patch.object(daily_store, 'read_day', side_effect=lambda date: saved):
            response = self.client.put('/api/daily/' + daily_store.today(), json=self.payload, headers=self.login())
            self.assertEqual(response.status_code, 200)
            other = self.client.application.test_client().get('/api/daily/today').json['report']
            self.assertEqual([r['quantity'] for r in other['storeRanking']], [0, 1, 2, 3, 4])
            self.assertEqual(other['targetAmount'], 1_000_000)
            self.assertTrue(other['targetConfirmed'])

    def test_rejects_unconfirmed_target_and_wrong_day(self):
        for change in ({'targetConfirmed': False}, {'date': '2000-01-01'}):
            with self.assertRaises(ValueError):
                daily_store.validate_document({**self.payload, **change})

    def test_stale_write_returns_conflict(self):
        with patch.object(daily_store, 'write_day', side_effect=ValueError('다른 관리자가 먼저 수정했습니다.')):
            response = self.client.put('/api/daily/' + daily_store.today(), json=self.payload, headers=self.login())
            self.assertEqual(response.status_code, 409)


if __name__ == '__main__':
    unittest.main()
