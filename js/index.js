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
const elements = {
    createSession: document.getElementById('create_session'),
    joinSection: document.getElementById('join_session'),
    sessionView: document.getElementById('session_view'),
    createBtn: document.getElementById('create_btn'),
    joinBtn: document.getElementById('join_btn'),
    sessionIdInput: document.getElementById('session_id_input'),
    currentSessionIdSpan: document.getElementById('current_session_id'),
    shareBtn: document.getElementById('share_btn'),
    listsContainer: document.getElementById('lists_container'),
    newItemInput: document.getElementById('new_item'),
    addBtn: document.getElementById('add_btn')
};

// Event listeners
elements.createBtn.addEventListener('click', createNewSession);
elements.joinBtn.addEventListener('click', joinExistingSession);
elements.shareBtn.addEventListener('click', shareSession);
elements.addBtn.addEventListener('click', addNewItem);

async function createNewSession() {
    try {
        const response = await fetch('/create_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: tg.initDataUnsafe.user?.id || 'default_user'
            })
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        if (data.status === 'success') {
            currentSessionId = data.session_id;
            setupSessionView();
            tg.showAlert(`Session created: ${currentSessionId}`);
        } else {
            throw new Error(data.message || 'Failed to create session');
        }
    } catch (error) {
        console.error('Create session error:', error);
        tg.showAlert('Failed to create session');
    }
}

async function joinExistingSession() {
    const sessionId = elements.sessionIdInput.value.trim();
    if (!sessionId) {
        tg.showAlert('Please enter session ID');
        return;
    }

    try {
        const response = await fetch('/join_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

function setupSessionView() {
    elements.createSession.classList.add('hidden');
    elements.joinSection.classList.add('hidden');
    elements.sessionView.classList.remove('hidden');
    elements.currentSessionIdSpan.textContent = currentSessionId;
}

function shareSession() {
    const shareUrl = `https://t.me/WhatToWatchTogether_bot?startapp=${currentSessionId}`;
    tg.shareUrl(shareUrl, `Join my Watch Together session: ${currentSessionId}`);
}

async function addNewItem() {
    const item = elements.newItemInput.value.trim();
    if (!item) {
        tg.showAlert('Please enter item text');
        return;
    }

    try {
        lists.push(item);
        elements.newItemInput.value = '';
        renderLists();

        const response = await fetch('/update_list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                list: lists
            })
        });

        if (!response.ok) throw new Error('Update failed');

        const data = await response.json();
        if (data.status !== 'success') {
            throw new Error('Update failed');
        }
    } catch (error) {
        console.error('Add item error:', error);
        lists.pop();
        renderLists();
        tg.showAlert('Failed to save item');
    }
}

function renderLists() {
    elements.listsContainer.innerHTML = '';
    lists.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.textContent = item;
        itemEl.className = 'list-item';
        elements.listsContainer.appendChild(itemEl);
    });
}

// Initial setup
function initialize() {
    if (tg.initDataUnsafe.start_param) {
        elements.sessionIdInput.value = tg.initDataUnsafe.start_param;
        joinExistingSession();
    } else {
        elements.createSession.classList.remove('hidden');
        elements.joinSection.classList.remove('hidden');
    }
}

initialize();