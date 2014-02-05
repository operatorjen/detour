import base64
import datetime
import os
import re
import StringIO
import tempfile
from functools import wraps

import bleach
from flask import Blueprint, g, jsonify, request
from PIL import Image
from PIL.ExifTags import TAGS
from sqlalchemy.orm.exc import NoResultFound

import settings
from database import db
from models import Message, User


IMAGE_WIDTH = 300
ALLOWED_EXTENSIONS = ('gif', 'jpg', 'jpeg', 'png')
EMAIL_RE = re.compile('[^@]+@[^@]+\.[^@]+')


api = Blueprint('api', __name__)


#@mod.route('/')
#def index():
#    pass  # link to docs?


def api_response(data, code, msg):
    content = {}
    if data is not None:
        content['data'] = data
    content['meta'] = {'code': code, 'message': msg}
    return jsonify(**content), code


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            return api_response(None, 403, 'not authorized')
        return f(*args, **kwargs)
    return decorated_function


@api.route('/me', methods=['GET', 'PUT'])
@login_required
def me():
    if request.method == 'GET':
        return api_response(g.user.to_json(), 200,
                            'profile retrieved successfully')
    elif request.method == 'PUT':
        notify = request.form.get('email_notification') == 'true'
        if g.user.notification != notify:
            g.user.notification = notify
            db.session.add(g.user)
            db.session.commit()
        return api_response({'email_notification': g.user.notification}, 200,
                            'profile updated successfully')


@api.route('/contact', methods=['POST'])
@login_required
def post_contact():
    email = request.form.get('email')

    if email:
        email = email.strip()
        if not EMAIL_RE.match(email):
            return api_response(None, 400, 'Contact not a valid email address')
        try:
            contact = User.query.filter(User.email==email).one()
        except NoResultFound:
            contact = User(email=email)
            db.session.add(contact)

        g.user.contacts.append(contact)
        db.session.commit()

        return api_response(contact.to_json(), 200,
                            'contact added successfully')
    else:
        return api_response(None, 400, 'Contact cannot be empty')


@api.route('/contact/<int:contact_id>', methods=['DELETE'])
@login_required
def delete_contact(contact_id):
    try:
        contact = User.query.filter(User.id==contact_id).one()
    except NoResultFound:
        return api_response(None, 404, 'contact not found')
    g.user.contacts.remove(contact)
    db.session.commit()

    return api_response(contact.to_json(), 200,
                        'contact removed successfully')


@api.route('/contacts')
@login_required
def get_contacts():
    return api_response([c.to_json() for c in g.user.contacts], 200,
                        'contacts retrieved successfully')


@api.route('/messages/unread')
@login_required
def get_unread_messages():
    messages = (
        Message.query.filter(Message.to_user==g.user)
                     .filter(db.or_(
                         Message.expire == None,
                         Message.expire > datetime.datetime.now()))
                     .order_by('created'))
    return api_response(
        [dict(id=m.id, email=m.from_user.email, avatar=m.from_user.avatar,
              has_media=bool(m.photo), created=m.created_stamp)
         for m in messages], 200, 'messages retrieved successfully')


@api.route('/message/<int:message_id>')
@login_required
def get_message(message_id):
    try:
        message = (
            Message.query.filter(Message.id==message_id,
                                 Message.to_user==g.user)
                         .filter(db.or_(
                             Message.expire == None,
                             Message.expire > datetime.datetime.now()))).one()
    except NoResultFound:
        return api_response(None, 404, 'message not found')

    # Update message with expired to schedule it for removal.
    if message.ttl > 10:
        message.expire = (datetime.datetime.now() +
                          datetime.timedelta(seconds=message.ttl))
    else:
        message.expire = datetime.datetime.now()
    db.session.commit()

    return api_response(message.to_json(), 200,
                        'message retrieved successfully')


@api.route('/message', methods=['POST'])
@login_required
def post_message():
    if not request.form.get('email'):
        return api_response(None, 400, 'Must specify `email` to send to.')
    if not (request.form.get('message') or request.files.get('photo')):
        return api_response(None, 400,
                            'Must specify `message` and/or `photo`.')

    def set_target(attrs, new=False):
        attrs['target'] = '_blank'
        return attrs

    email = request.form.get('email')
    message = bleach.linkify(request.form.get('message'), [set_target])
    ttl = request.form.get('ttl', settings.DEFAULT_TTL)
    photo = request.files.get('photo')

    # Look for "to" user in contacts. If not found, ignore message.
    # Note: We return the same message in the response to not leak who is
    # already in our db and who isn't.
    try:
        to_user = User.query.filter(User.email==email).one()
    except NoResultFound:
        return api_response(None, 400, 'recipient not a user')
    if not to_user in g.user.contacts:
        g.user.contacts.append(to_user)
        db.session.commit()

    # Handle photo.
    b64photo = ''
    if (photo and '.' in photo.filename):
        ext = photo.filename.rsplit('.', 1)[1].lower()
        if ext in ALLOWED_EXTENSIONS:
            path = tempfile.mkstemp()[1]
            photo.save(path)
            img = Image.open(path)
            x, y = img.size

            # Test if image is gif and is animated gif. If it's small enough,
            # don't bother trying to scale it.
            if ext == 'gif':
                try:
                    img.seek(img.tell() + 1)
                except EOFError:
                    # It's an animated gif b/c we could seek to the 2nd frame.
                    if x > IMAGE_WIDTH or y > IMAGE_WIDTH:
                        return api_response(
                            None, 400, 'Invalid image format: animated gif')
                    else:
                        pass
            # Get orientation.
            if hasattr(img, '_getexif') and img._getexif():
                exif = dict((TAGS.get(k, k), v)
                            for k, v in img._getexif().items())
                orientation = exif.get('Orientation')
                if orientation:
                    if orientation == 1:  # Horizontal (normal).
                        pass  # Image is ok.
                    elif orientation == 2:  # Mirrored horizontal.
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    elif orientation == 3:  # Rotated 180.
                        img = img.transpose(Image.ROTATE_180)
                    elif orientation == 4:  # Mirrored vertical.
                        img = img.transpose(Image.FLIP_TOP_BOTTOM)
                    elif orientation == 5:  # Mirrored horiz, rotated 90 CCW.
                        img = (img.transpose(Image.FLIP_TOP_BOTTOM)
                                  .transpose(Image.ROTATE_270))
                    elif orientation == 6:  # Rotated 90 CW.
                        img = img.transpose(Image.ROTATE_270)
                    elif orientation == 7:  # Mirrored horiz, rotated 90 CW.
                        img = (img.transpose(Image.FLIP_LEFT_RIGHT)
                                  .transpose(Image.ROTATE_270))
                    elif orientation == 8:  # Rotated 90 CCW.
                        img = img.transpose(Image.ROTATE_90)
            # Find ratio to scale to IMAGE_WIDTH and keep aspect ratio.
            ratio = float(IMAGE_WIDTH) / x
            img = img.resize((int(x * ratio), int(y * ratio)), Image.ANTIALIAS)
            buf = StringIO.StringIO()
            img.save(buf, 'JPEG')
            buf.seek(0)
            b64photo = 'data:image/jpg;base64,%s' % (
                base64.b64encode(buf.read()))
            os.unlink(path)

    message = Message(to_user=to_user, from_user=g.user,
                      message=message, photo=b64photo, ttl=ttl)
    db.session.add(message)
    db.session.commit()

    # TODO: Queue this instead so we don't have to wait.
    message.send_notification()

    return api_response(None, 200, 'message created successfully')
