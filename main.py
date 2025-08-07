from flask import Flask, render_template, request, jsonify
import secrets
from collections import defaultdict

app = Flask(__name__, template_folder='.')
app.secret_key = 'your-secret-key'

# Хранилище данных в памяти (в реальном приложении используйте БД)
shared_lists = defaultdict(dict)
sessions = {}


@app.route('/')
def web():
    return render_template('index.html')


@app.route('/create_session', methods=['POST'])
def create_session():
    session_id = secrets.token_urlsafe(8)
    user_id = request.json.get('user_id')
    sessions[session_id] = {'users': [user_id], 'lists': {}}
    return jsonify({'session_id': session_id})


@app.route('/join_session', methods=['POST'])
def join_session():
    session_id = request.json.get('session_id')
    user_id = request.json.get('user_id')

    if session_id in sessions:
        sessions[session_id]['users'].append(user_id)
        return jsonify({'status': 'success', 'lists': sessions[session_id]['lists']})
    return jsonify({'status': 'error', 'message': 'Session not found'}), 404


@app.route('/update_list', methods=['POST'])
def update_list():
    session_id = request.json.get('session_id')
    list_data = request.json.get('list')

    if session_id in sessions:
        sessions[session_id]['lists'] = list_data
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error'}), 404


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=80)