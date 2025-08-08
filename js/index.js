document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;

    if (!tg) {
        alert('Telegram WebApp не инициализирован!');
        throw new Error('Telegram WebApp не инициализирован');
    }

    tg.expand();
    tg.ready();

    let currentSessionId = null;
    let sessions = JSON.parse(localStorage.getItem('sessions') || '{}');
    let lists = [];

    const SESSION_STORAGE_KEY = 'last_session_id';

    // DOM элементы
    const elements = {
        mainMenu: document.getElementById('main_menu'),
        joinSection: document.getElementById('join_session'),
        sessionList: document.getElementById('session_list'),
        sessionView: document.getElementById('session_view'),
        createBtn: document.getElementById('create_btn'),
        joinBtn: document.getElementById('join_btn'),
        listBtn: document.getElementById('list_btn'),
        joinSubmitBtn: document.getElementById('join_submit_btn'),
        backBtn: document.getElementById('back_btn'),
        listBackBtn: document.getElementById('list_back_btn'),
        sessionBackBtn: document.getElementById('session_back_btn'),
        sessionIdInput: document.getElementById('session_id_input'),
        currentSessionIdSpan: document.getElementById('current_session_id'),
        shareBtn: document.getElementById('share_btn'),
        copyBtn: document.getElementById('copy_btn'),
        listsContainer: document.getElementById('lists_container'),
        sessionsContainer: document.getElementById('sessions_container'),
        newItemInput: document.getElementById('new_item'),
        addBtn: document.getElementById('add_btn')
    };

    // Проверка наличия всех элементов
    const missingElements = Object.keys(elements).filter(key => !elements[key]);
    if (missingElements.length > 0) {
        console.error('Отсутствуют элементы DOM:', missingElements);
        alert('Ошибка: некоторые элементы интерфейса не найдены. Проверьте HTML.');
        return;
    }

    // Обработчики событий
    elements.createBtn.addEventListener('click', createNewSession);
    elements.joinBtn.addEventListener('click', showJoinSection);
    elements.listBtn.addEventListener('click', showSessionList);
    elements.joinSubmitBtn.addEventListener('click', joinExistingSession);
    elements.backBtn.addEventListener('click', showMainMenu);
    elements.listBackBtn.addEventListener('click', showMainMenu);
    elements.sessionBackBtn.addEventListener('click', showMainMenu);
    elements.shareBtn.addEventListener('click', shareSession);
    elements.copyBtn.addEventListener('click', copySessionId);
    elements.addBtn.addEventListener('click', addNewItem);

    function showMainMenu() {
        elements.mainMenu.classList.remove('hidden');
        elements.joinSection.classList.add('hidden');
        elements.sessionList.classList.add('hidden');
        elements.sessionView.classList.add('hidden');
    }

    function showJoinSection() {
        elements.mainMenu.classList.add('hidden');
        elements.joinSection.classList.remove('hidden');
        elements.sessionList.classList.add('hidden');
        elements.sessionView.classList.add('hidden');
    }

    function showSessionList() {
        elements.mainMenu.classList.add('hidden');
        elements.joinSection.classList.add('hidden');
        elements.sessionList.classList.remove('hidden');
        elements.sessionView.classList.add('hidden');
        renderSessions();
    }

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
                sessions[currentSessionId] = { lists: [] };
                localStorage.setItem('sessions', JSON.stringify(sessions));
                localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
                lists = sessions[currentSessionId].lists;
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

        elements.joinSubmitBtn.disabled = true;
        elements.joinSubmitBtn.textContent = 'Присоединение...';
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
                if (!sessions[currentSessionId]) {
                    sessions[currentSessionId] = { lists: [] };
                }
                localStorage.setItem('sessions', JSON.stringify(sessions));
                localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
                lists = sessions[currentSessionId].lists;
                setupSessionView();
                renderLists();
                tg.showAlert('Успешно присоединились к сессии');
            } else {
                throw new Error(data.message || 'Сессия не найдена');
            }
        } catch (error) {
            console.error('Ошибка присоединения:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
            if (error.message.includes('Session not found')) {
                delete sessions[sessionId];
                localStorage.setItem('sessions', JSON.stringify(sessions));
                localStorage.removeItem(SESSION_STORAGE_KEY);
            }
        } finally {
            elements.joinSubmitBtn.disabled = false;
            elements.joinSubmitBtn.textContent = 'Присоединиться';
        }
    }

    function setupSessionView() {
        elements.mainMenu.classList.add('hidden');
        elements.joinSection.classList.add('hidden');
        elements.sessionList.classList.add('hidden');
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
            sessions[currentSessionId].lists = lists;
            localStorage.setItem('sessions', JSON.stringify(sessions));
            elements.newItemInput.value = '';
            renderLists();
        } catch (error) {
            console.error('Ошибка добавления:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
        } finally {
            elements.addBtn.disabled = false;
            elements.addBtn.textContent = 'Добавить';
        }
    }

    async function deleteItem(index) {
        try {
            lists.splice(index, 1);
            sessions[currentSessionId].lists = lists;
            localStorage.setItem('sessions', JSON.stringify(sessions));
            renderLists();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
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

    function renderSessions() {
        elements.sessionsContainer.innerHTML = '';
        Object.keys(sessions).forEach(sessionId => {
            const sessionEl = document.createElement('div');
            sessionEl.className = 'list-item';

            const textEl = document.createElement('span');
            textEl.textContent = `Сессия: ${sessionId}`;

            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-primary btn-small';
            joinBtn.textContent = 'Присоединиться';
            joinBtn.onclick = () => joinExistingSession(sessionId);

            sessionEl.appendChild(textEl);
            sessionEl.appendChild(joinBtn);
            elements.sessionsContainer.appendChild(sessionEl);
        });
    }

    // Инициализация
    function initialize() {
        const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSessionId && sessions[savedSessionId]) {
            currentSessionId = savedSessionId;
            lists = sessions[currentSessionId].lists;
            joinExistingSession(savedSessionId);
        } else if (tg.initDataUnsafe.start_param) {
            elements.sessionIdInput.value = tg.initDataUnsafe.start_param;
            joinExistingSession(tg.initDataUnsafe.start_param);
        } else {
            elements.mainMenu.classList.remove('hidden');
        }
    }

    initialize();
});