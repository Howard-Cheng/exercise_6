import sqlite3
import string
import random
from datetime import datetime
from flask import Flask, request, jsonify, g

from functools import wraps

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


def get_db():
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/watchparty.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one:
            return rows[0]
        return rows
    return None


def new_user():
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(
        string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(
        string.ascii_lowercase + string.digits, k=40))
    u = query_db('insert into users (name, password, api_key) ' +
                 'values (?, ?, ?) returning id, name, password, api_key',
                 (name, password, api_key),
                 one=True)
    return u

# TODO: If your app sends users to any other routes, include them here.
#       (This should not be necessary).


@app.route('/')
@app.route('/profile')
@app.route('/login')
@app.route('/room')
@app.route('/room/<chat_id>')
def index(chat_id=None):
    return app.send_static_file('index.html')


@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404


# -------------------------------- API ROUTES ----------------------------------

# TODO: Create the API

# @app.route('/api/signup')
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data['username']
    # Consider hashing this password with Werkzeug or similar
    password = data['password']
    api_key = ''.join(random.choices(
        string.ascii_letters + string.digits, k=40))

    db = get_db()
    try:
        db.execute('INSERT INTO users (username, password, api_key) VALUES (?, ?, ?)',
                   (username, password, api_key))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409

    return jsonify({'api_key': api_key}), 201


# @app.route('/api/login')
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data['username']
    password = data['password']  # Add hash comparison if you hash passwords

    user = query_db('SELECT * FROM users WHERE username = ? AND password = ?',
                    [username, password], one=True)

    if user:
        return jsonify({'api_key': user['api_key']}), 200
    else:
        return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/room/create', methods=['POST'])
def create_room():
    api_key = request.headers.get('Authorization')
    data = request.json
    room_name = data['name']

    user_id = query_db('SELECT id FROM users WHERE api_key = ?', [
                       api_key], one=True)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    db = get_db()
    db.execute('INSERT INTO rooms (name, created_by) VALUES (?, ?)',
               (room_name, user_id['id']))
    db.commit()

    return jsonify({'success': True, 'message': 'Room created'}), 201


@app.route('/api/room/<int:room_id>/rename', methods=['POST'])
def rename_room(room_id):
    api_key = request.headers.get('Authorization')
    data = request.json
    new_name = data['name']

    user_id = query_db('SELECT id FROM users WHERE api_key = ?', [
                       api_key], one=True)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    db = get_db()
    db.execute('UPDATE rooms SET name = ? WHERE id = ?', (new_name, room_id))
    db.commit()

    return jsonify({'success': True, 'message': 'Room renamed'}), 200


@app.route('/api/room/<int:room_id>/message', methods=['POST'])
def post_message(room_id):
    api_key = request.headers.get('Authorization')
    data = request.json
    message = data['message']

    user_id = query_db('SELECT id FROM users WHERE api_key = ?', [
                       api_key], one=True)
    if not user_id:
        return jsonify({'error': 'Unauthorized'}), 403

    db = get_db()
    db.execute('INSERT INTO messages (room_id, user_id, message) VALUES (?, ?, ?)',
               (room_id, user_id['id'], message))
    db.commit()

    return jsonify({'success': True, 'message': 'Message posted'}), 201


@app.route('/api/room/<int:room_id>/messages', methods=['GET'])
def get_messages(room_id):
    api_key = request.headers.get('Authorization')
    user = query_db('SELECT * FROM users WHERE api_key = ?',
                    [api_key], one=True)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 403

    messages = query_db(
        'SELECT message, created_at FROM messages WHERE room_id = ? ORDER BY created_at DESC', [room_id])

    return jsonify(messages), 200
