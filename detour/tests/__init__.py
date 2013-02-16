import unittest

from detour.app import create_app
from detour.database import db


class DetourTestCase(unittest.TestCase):

    def setUp(self):
        config = {
            'SQLALCHEMY_DATABASE_URI': 'sqlite://',
            'TESTING': True,
        }
        self.app = create_app(config)
        db.create_all()
        self.client = self.app.test_client()

    def login(self, email):
        with self.client.session_transaction() as sess:
            sess['email'] = email
