import json

from nose.tools import ok_, eq_

from detour.models import User
from detour.database import db

from . import DetourTestCase


class TestMeApi(DetourTestCase):

    def test_me(self):
        user = User(email='test@testicl.es')
        db.session.add(user)
        db.session.commit()
        self.login(user.email)

        rv = self.client.get('/1.0/me')
        eq_(rv.status_code, 200)
        data = json.loads(rv.data)
        eq_(data['meta']['code'], 200)
        eq_(data['data']['email'], user.email)
        eq_(data['data']['avatar'], user.avatar)
