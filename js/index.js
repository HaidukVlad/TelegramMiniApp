const tg = window.Telegram.WebApp;

if (!tg) {
    alert('Telegram WebApp не инициализирован!');
    throw new Error('Telegram WebApp не инициализирован');
}

tg.expand();
tg.ready();

let currentSessionId = null;
let lists = [];

const SESSION_STORAGE_KEY = 'last_session_id';

// DOM элементы
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
    addBtn: document.getElementById('add_btn'),
    copyBtn: document.getElementById('copy_btn')
};

// Обработчики событий
elements.createBtn.addEventListener('click', createNewSession);
elements.joinBtn.addEventListener('click', joinExistingSession);
elements.shareBtn.addEventListener('click', shareSession);
elements.addBtn.addEventListener('click', addNewItem);
elements.copyBtn.addEventListener('click', copySessionId);

async function createNewSession() {
    elements.createBtn.disabled = true;
    elements.createBtn.textContent = 'Создание...';
    try {
        const response = await fetch('/create_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: tg.initDataUnsafe.user?.id || 'default_user'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP ошибка: ${response.status}`);
        }

        if (data.status === 'success') {
            currentSessionId = data.session_id;
            // Сохраняем session_id
            localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
            setupSessionView();
            tg.showAlert(`Сессия создана: ${currentSessionId}`);
        } else {
            throw new Error(data.message || 'Не удалось создать сессию');
        }
    } catch (error) {
        console.error('Ошибка создания сессии:', error);
        tg.showAlert(`Ошибка: ${error.message}`);
    } finally {
        elements.createBtn.disabled = false;
        elements.createBtn.textContent = 'Создать комнату';
    }
}

async function joinExistingSession(sessionId = elements.sessionIdInput.value.trim()) {
    if (!sessionId) {
        tg.showAlert('Введите ID сессии');
        return;
    }

    elements.joinBtn.disabled = true;
    elements.joinBtn.textContent = 'Присоединение...';
    try {
        const response = await fetch('/join_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                user_id: tg.initDataUnsafe.user?.id || 'default_user'
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP ошибка: ${response.status}`);
        }

        if (data.status === 'success') {
            currentSessionId = sessionId;
            localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
            lists = data.lists || [];
            setupSessionView();
            renderLists();
            tg.showAlert('Успешно присоединились к сессии');
        } else {
            throw new Error(data.message || 'Сессия не найдена');
        }
    } catch (error) {
        console.error('Ошибка присоединения:', error);
        tg.showAlert(`Ошибка: ${error.message}`);
        // Удаляем session_id, если сессия истекла или не найдена
        if (error.message.includes('Session expired') || error.message.includes('Session not found')) {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        }
    } finally {
        elements.joinBtn.disabled = false;
        elements.joinBtn.textContent = 'Присоединиться';
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
    tg.shareUrl(shareUrl, `Присоединяйтесь к моей сессии: ${currentSessionId}`);
}

function copySessionId() {
    navigator.clipboard.writeText(currentSessionId);
    tg.showAlert('ID сессии скопирован!');
}

async function addNewItem() {
    const item = elements.newItemInput.value.trim();
    if (!item) {
        tg.showAlert('Введите текст элемента');
        return;
    }

    elements.addBtn.disabled = true;
    elements.addBtn.textContent = 'Добавление...';
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

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP ошибка: ${response.status}`);
        }

        if (data.status !== 'success') {
            throw new Error('Не удалось обновить список');
        }
    } catch (error) {
        console.error('Ошибка добавления:', error);
        lists.pop();
        renderLists();
        tg.showAlert(`Ошибка: ${error.message}`);
    } finally {
        elements.addBtn.disabled = false;
        elements.addBtn.textContent = 'Добавить';
    }
}

async function deleteItem(index) {
    try {
        lists.splice(index, 1);
        renderLists();

        const response = await fetch('/update_list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                list: lists
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP ошибка: ${response.status}`);
        }

        if (data.status !== 'success') {
            throw new Error('Не удалось обновить список');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        tg.showAlert(`Ошибка: ${error.message}`);
        // Восстанавливаем список при ошибке
        renderLists();
    }
}

function renderLists() {
    elements.listsContainer.innerHTML = '';
    lists.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'list-item';

        const textEl = document.createElement('span');
        textEl.textContent = item;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-secondary btn-small';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.onclick = () => deleteItem(index);

        itemEl.appendChild(textEl);
        itemEl.appendChild(deleteBtn);
        elements.listsContainer.appendChild(itemEl);
    });
}

// Инициализация
function initialize() {
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSessionId) {
        elements.sessionIdInput.value = savedSessionId;
        joinExistingSession(savedSessionId);
    } else if (tg.initDataUnsafe.start_param) {
        elements.sessionIdInput.value = tg.initDataUnsafe.start_param;
        joinExistingSession(tg.initDataUnsafe.start_param);
    } else {
        elements.createSession.classList.remove('hidden');
        elements.joinSection.classList.remove('hidden');
    }
}

initialize();