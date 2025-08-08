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
        copyBtn: document.getElementById('copy_btn'),
        listsContainer: document.getElementById('lists_container'),
        sessionsContainer: document.getElementById('sessions_container'),
        newItemInput: document.getElementById('new_item'),
        addBtn: document.getElementById('add_btn'),
        sessionNameInput: document.getElementById('session_name_input'),
        clearSessionsBtn: document.getElementById('clear_sessions_btn')
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
    elements.copyBtn.addEventListener('click', copySessionId);
    elements.addBtn.addEventListener('click', addNewItem);
    elements.clearSessionsBtn.addEventListener('click', clearSessions);

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

    async function showSessionList() {
        elements.mainMenu.classList.add('hidden');
        elements.joinSection.classList.add('hidden');
        elements.sessionList.classList.remove('hidden');
        elements.sessionView.classList.add('hidden');
        await renderSessions();
    }

    async function createNewSession() {
        const sessionName = elements.sessionNameInput.value.trim() || `Сессия ${new Date().toLocaleDateString('ru-RU')}`;
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
                sessions[currentSessionId] = { name: sessionName, lists: [] };
                localStorage.setItem('sessions', JSON.stringify(sessions));
                localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
                lists = sessions[currentSessionId].lists;
                elements.sessionNameInput.value = '';
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
                    sessions[currentSessionId] = { name: `Сессия ${sessionId}`, lists: [] };
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

    async function deleteSession(sessionId) {
        try {
            delete sessions[sessionId];
            localStorage.setItem('sessions', JSON.stringify(sessions));
            if (currentSessionId === sessionId) {
                localStorage.removeItem(SESSION_STORAGE_KEY);
                currentSessionId = null;
            }
            await renderSessions();
            tg.showAlert('Сессия удалена');
        } catch (error) {
            console.error('Ошибка удаления сессии:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
        }
    }

    function clearSessions() {
        sessions = {};
        localStorage.removeItem('sessions');
        localStorage.removeItem(SESSION_STORAGE_KEY);
        currentSessionId = null;
        renderSessions();
        tg.showAlert('Все сессии удалены');
    }

    async function renderLists() {
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

    async function renderSessions() {
        elements.sessionsContainer.innerHTML = '';
        for (const sessionId of Object.keys(sessions)) {
            const sessionEl = document.createElement('div');
            sessionEl.className = 'list-item';

            const detailsEl = document.createElement('div');
            detailsEl.className = 'session-details';

            const textEl = document.createElement('span');
            textEl.textContent = sessions[sessionId].name;

            const buttonsEl = document.createElement('div');
            buttonsEl.style.display = 'flex';
            buttonsEl.style.gap = '0.5rem';

            const joinBtn = document.createElement('button');
            joinBtn.className = 'btn btn-primary btn-small';
            joinBtn.textContent = 'Присоединиться';
            joinBtn.onclick = () => joinExistingSession(sessionId);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-secondary btn-small';
            deleteBtn.textContent = 'Удалить';
            deleteBtn.onclick = () => deleteSession(sessionId);

            buttonsEl.appendChild(joinBtn);
            buttonsEl.appendChild(deleteBtn);
            detailsEl.appendChild(textEl);
            detailsEl.appendChild(buttonsEl);

            // Получение списка пользователей
            try {
                const response = await fetch(`/get_session_info?session_id=${sessionId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (data.status === 'success') {
                    const usersEl = document.createElement('div');
                    usersEl.className = 'users-list';
                    usersEl.textContent = `Пользователи: ${data.users.length > 0 ? data.users.join(', ') : 'Нет пользователей'}`;
                    sessionEl.appendChild(detailsEl);
                    sessionEl.appendChild(usersEl);
                }
            } catch (error) {
                console.error('Ошибка получения пользователей:', error);
            }

            elements.sessionsContainer.appendChild(sessionEl);
        }
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