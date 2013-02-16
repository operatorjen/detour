from flask import Blueprint, g, jsonify


api = Blueprint('api', __name__)


#@mod.route('/')
#def index():
#    pass  # link to docs?


@api.route('/me')
def me():
    if g.user:
        return jsonify(
            data=g.user.to_json(),
            meta={'code': 200, 'message': 'profile returned successfully'}
        )
    else:
        return jsonify(
            data={}, meta={'code': 403, 'message': 'not authorized'}
        )

