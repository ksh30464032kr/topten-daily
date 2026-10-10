import unittest
from unittest.mock import patch
from flask import Flask
from location_store import register_location_routes, validate_locations

class LocationTests(unittest.TestCase):
 def setUp(self):
  app=Flask(__name__);register_location_routes(app);self.client=app.test_client()
  self.payload={'revision':'0','items':[{'id':'test','name':'그래픽 후드','aliases':'그림 후드','floor':'1층','group':'남성','location':'테스트 위치'}]}
 def test_auth_and_validation(self):
  self.assertEqual(self.client.put('/api/locations',json=self.payload).status_code,401)
  with self.assertRaises(ValueError):validate_locations({'items':[{'id':'x'}]})
 def test_shared_save_and_conflict(self):
  with patch('location_store.is_admin',return_value=True),patch('location_store.write_day',return_value=self.payload) as write:
   self.assertEqual(self.client.put('/api/locations',json=self.payload).status_code,200)
   self.assertEqual(write.call_args.args[3],'locations')
  with patch('location_store.read_day',return_value=self.payload):
   self.assertEqual(self.client.get('/api/locations').json['items'][0]['name'],'그래픽 후드')
  with patch('location_store.is_admin',return_value=True),patch('location_store.write_day',side_effect=ValueError('다른 관리자가 먼저 수정했습니다.')):
   self.assertEqual(self.client.put('/api/locations',json=self.payload).status_code,409)
