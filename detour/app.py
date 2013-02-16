# -*- coding: utf-8 -*-
import os

import browserid
from flask import Flask, g, jsonify, render_template, request, session
from sqlalchemy.orm.exc import NoResultFound

import settings
from api import api
from database import db
from models import *


default_config = {
    'DEBUG': getattr(settings, 'DEBUG', False),
    'SECRET_KEY': settings.SESSION_SECRET,
}


def create_app(config):
    app = Flask(__name__)
    app.config.update(default_config)
    app.config.update(config)
    app.register_blueprint(api, url_prefix='/1.0')

    db.app = app
    db.init_app(app)

    @app.before_request
    def load_current_user():
        g.user = (User.query.filter_by(email=session['email']).first()
                  if 'email' in session else None)

    @app.route('/', methods=['GET'])
    def main():
        """Default landing page."""
        return render_template('index.html', authenticated=bool(g.user))

    @app.route('/authenticate', methods=['POST'])
    def set_email():
        """Verify via Persona.

        Upon success, create the user if it doesn't already exist and set the email
        for the user's session.
        """
        data = browserid.verify(request.form['assertion'], settings.SITE_URL)
        email = data['email']

        # Create user record.
        try:
            user = User.query.filter(User.email==email).one()
        except NoResultFound:
            user = User(email=email)
            db.add(user)
            db.commit()

        session['email'] = user.email
        return jsonify({'message':'okay'})

    @app.route('/logout', methods=['GET', 'POST'])
    def logout():
        """Log the user out."""
        session.pop('email', None)
        return jsonify({'message':'okay'})

    @app.errorhandler(404)
    def page_not_found(error):
        return render_template('404.html')

    @app.errorhandler(500)
    def something_broke(error):
        return render_template('500.html')

    return app

if __name__ == '__main__':
    app = create_app({'DEBUG': True,
                      'SQLALCHEMY_DATABASE_URI': os.environ.get(
                          'DATABASE_URL', 'sqlite:///detour_app.db')})
    app.run()
