from flask import Flask, render_template, request, jsonify
import secrets
from collections import defaultdict
from flask_cors import CORS
import logging

app = Flask(__name__, template_folder='.')
CORS(app, resources={r"/*": {"origins": "*"}})
app.secret_key = secrets.token_urlsafe(16)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Хранилище сессий
sessions = defaultdict(lambda: {'users': [], 'lists': []})


@app.route('/')
def index():
    logger.info("Serving index.html")
    return render_template('index.html')


@app.route('/create_session', methods=['POST'])
def create_session():
    try:
        data = request.get_json()
        if not data:
            raise ValueError("No JSON data provided")
        user_id = data.get('user_id', 'unknown')
        logger.info(f"Creating session for user: {user_id}")

        session_id = secrets.token_urlsafe(8)
        sessions[session_id]['users'] = [user_id]
        sessions[session_id]['lists'] = []

        logger.info(f"Session created: {session_id}")
        return jsonify({'status': 'success', 'session_id': session_id})
    except Exception as e:
        logger.error(f"Error in create_session: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/join_session', methods=['POST'])
def join_session():
    try:
        data = request.get_json()
        if not data:
            raise ValueError("No JSON data provided")
        session_id = data.get('session_id')
        user_id = data.get('user_id', 'unknown')
        logger.info(f"Joining session {session_id} for user: {user_id}")

        if session_id in sessions:
            if user_id not in sessions[session_id]['users']:
                sessions[session_id]['users'].append(user_id)
            return jsonify({
                'status': 'success',
                'lists': sessions[session_id]['lists']
            })
        logger.error(f"Session not found: {session_id}")
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    except Exception as e:
        logger.error(f"Error in join_session: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/update_list', methods=['POST'])
def update_list():
    try:
        data = request.get_json()
        if not data:
            raise ValueError("No JSON data provided")
        session_id = data.get('session_id')
        list_data = data.get('list')
        logger.info(f"Updating list for session: {session_id}")

        if session_id in sessions:
            sessions[session_id]['lists'] = list_data
            return jsonify({'status': 'success'})
        logger.error(f"Session not found: {session_id}")
        return jsonify({'status': 'error', 'message': 'Session not found'}), 404
    except Exception as e:
        logger.error(f"Error in update_list: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)