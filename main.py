from flask import Flask, render_template
import logging

app = Flask(__name__, template_folder='.')
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/')
def index():
    logger.info("Serving index.html")
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)