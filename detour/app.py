# -*- coding: utf-8 -*-
import browserid
from flask import Flask, g, jsonify, render_template, request, session
from sqlalchemy.orm.exc import NoResultFound

import settings
from api import api
from database import db
from models import *


default_config = {
    'DEBUG': settings.DEBUG,
    'PREFERRED_URL_SCHEME': settings.PREFERRED_URL_SCHEME,
    'SECRET_KEY': settings.SECRET_KEY,
    'SERVER_NAME': settings.SERVER_NAME,
    'SQLALCHEMY_DATABASE_URI': settings.DATABASE_URL,
    'SQLALCHEMY_ECHO': settings.DEBUG_SQL,
    'TRAP_HTTP_EXCEPTIONS': settings.DEBUG,
    'TRAP_BAD_REQUEST_ERRORS': settings.DEBUG,
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
        g.user = (User.query.filter_by(email=session.get('email')).first()
                  if 'email' in session else None)

    @app.route('/', methods=['GET'])
    def main():
        """Default landing page."""
        notification = False
        if g.user:
            notification = bool(g.user.notification)
        return render_template('index.html', authenticated=bool(g.user),
            notification=notification,
            debug=settings.DEBUG)

    @app.route('/authenticate', methods=['POST'])
    def set_email():
        """Verify via Persona.

        Upon success, create the user if it doesn't already exist and set the
        email for the user's session.
        """
        data = browserid.verify(request.form['assertion'], '%s://%s' % (
            app.config['PREFERRED_URL_SCHEME'], app.config['SERVER_NAME']))
        email = data['email']

        # Create user record.
        try:
            user = User.query.filter(User.email==email).one()
        except NoResultFound:
            user = User(email=email)
            db.session.add(user)
            db.session.commit()
            # Add self as contact.
            user.contacts.append(user)
            db.session.commit()

        session['email'] = user.email
        return jsonify({'message': 'okay'})

    @app.route('/logout', methods=['GET', 'POST'])
    def logout():
        """Log the user out."""
        session.pop('email', None)
        return jsonify({'message': 'okay'})

    @app.route('/detour.webapp', methods=['GET'])
    def webapp():
        """Loads the webapp manifest."""
        webapp = {
            'version': '1.0.1',
            'name': 'Detour',
            'default_locale': 'en-US',
            'icons': {
                '72': '/static/images/logo-72.png',
                '114': '/static/images/logo-114.png',
                '128': '/static/images/logo-128.png',
                '256': '/static/images/logo-256.png',
            },
            'description': 'Ephemeral messaging',
            'launch_path': '/',
            'developer': {
                'url': 'https://detourapp.com',
                'name': 'ednapiranha, robhudson',
            }
        }
        resp = jsonify(webapp)
        resp.mimetype = 'application/x-web-app-manifest+json'
        return resp

    @app.errorhandler(404)
    def page_not_found(error):
        return render_template('404.html'), 404

    @app.errorhandler(500)
    def something_broke(error):
        return render_template('500.html'), 500

    return app

if __name__ == '__main__':
    app = create_app(default_config)
    app.run()
