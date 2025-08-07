const tg = window.Telegram.WebApp;
tg.expand();

let currentSessionId = null;
let lists = [];

// DOM elements
const createSection = document.getElementById('create_session');
const joinSection = document.getElementById('join_session');
const sessionView = document.getElementById('session_view');
const createBtn = document.getElementById('create_btn');
const joinBtn = document.getElementById('join_btn');
const sessionIdInput = document.getElementById('session_id_input');
const currentSessionIdSpan = document.getElementById('current_session_id');
const shareBtn = document.getElementById('share_btn');
const listsContainer = document.getElementById('lists_container');
const newItemInput = document.getElementById('new_item');
const addBtn = document.getElementById('add_btn');

// Event listeners
createBtn.addEventListener('click', createNewSession);
joinBtn.addEventListener('click', joinExistingSession);
shareBtn.addEventListener('click', shareSession);
addBtn.addEventListener('click', addNewItem);

function createNewSession() {
    fetch('/create_session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_id: tg.initDataUnsafe.user?.id
        })
    })
    .then(response => response.json())
    .then(data => {
        currentSessionId = data.session_id;
        setupSessionView();
    });
}

function joinExistingSession() {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) return;

    fetch('/join_session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            session_id: sessionId,
            user_id: tg.initDataUnsafe.user?.id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            currentSessionId = sessionId;
            lists = data.lists || [];
            setupSessionView();
            renderLists();
        } else {
            alert('Session not found');
        }
    });
}

function setupSessionView() {
    createSection.classList.add('hidden');
    joinSection.classList.add('hidden');
    sessionView.classList.remove('hidden');
    currentSessionIdSpan.textContent = currentSessionId;
}

function shareSession() {
    const shareUrl = `https://t.me/YOUR_BOT_USERNAME/YOUR_APP_NAME?startapp=${currentSessionId}`;
    tg.shareUrl(shareUrl);
}

function addNewItem() {
    const item = newItemInput.value.trim();
    if (!item) return;

    lists.push(item);
    newItemInput.value = '';

    fetch('/update_list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            session_id: currentSessionId,
            list: lists
        })
    });

    renderLists();
}

function renderLists() {
    listsContainer.innerHTML = '';
    lists.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.textContent = item;
        listsContainer.appendChild(itemEl);
    });
}

// Initial setup
if (tg.initDataUnsafe.start_param) {
    // If launched with session ID in start_param
    sessionIdInput.value = tg.initDataUnsafe.start_param;
    joinExistingSession();
} else {
    createSection.classList.remove('hidden');
    joinSection.classList.remove('hidden');
}