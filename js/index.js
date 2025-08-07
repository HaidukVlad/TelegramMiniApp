const tg = window.Telegram.WebApp;
if (!tg) {
    alert('Telegram WebApp not initialized!');
    throw new Error('Telegram WebApp not initialized');
}
tg.expand();
tg.ready();

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

async function createNewSession() {
    try {
        const response = await fetch('/create_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: tg.initDataUnsafe.user?.id || 'default_user'
            })
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        currentSessionId = data.session_id;
        setupSessionView();
        tg.showAlert(`Session created: ${currentSessionId}`);
    } catch (error) {
        console.error('Create session error:', error);
        tg.showAlert('Failed to create session');
    }
}

async function joinExistingSession() {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) {
        tg.showAlert('Please enter session ID');
        return;
    }

    try {
        const response = await fetch('/join_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                user_id: tg.initDataUnsafe.user?.id || 'default_user'
            })
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        if (data.status === 'success') {
            currentSessionId = sessionId;
            lists = data.lists || [];
            setupSessionView();
            renderLists();
            tg.showAlert('Successfully joined session');
        } else {
            tg.showAlert(data.message || 'Session not found');
        }
    } catch (error) {
        console.error('Join session error:', error);
        tg.showAlert('Failed to join session');
    }
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
    const shareUrl = `https://t.me/WhatToWatchTogether_bot?startapp=${currentSessionId}`;
    tg.shareUrl(shareUrl);
}

async function addNewItem() {
    const item = newItemInput.value.trim();
    if (!item) {
        tg.showAlert('Please enter item text');
        return;
    }

    try {
        lists.push(item);
        newItemInput.value = '';
        renderLists();

        const response = await fetch('/update_list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                list: lists
            })
        });

        if (!response.ok) throw new Error('Update failed');

    } catch (error) {
        console.error('Add item error:', error);
        tg.showAlert('Failed to save item');
        lists.pop(); // Откатываем изменение при ошибке
        renderLists();
    }
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