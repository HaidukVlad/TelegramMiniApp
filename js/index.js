document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;

    if (!tg) {
        alert('Telegram WebApp не инициализирован!');
        throw new Error('Telegram WebApp не инициализирован');
    }

    tg.expand();
    tg.ready();

    // Инициализация Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyA7eZyKVLL9AmPKjFlEsktb9EH2UUpZyco",
        authDomain: "whattowatchtogether.firebaseapp.com",
        projectId: "whattowatchtogether",
        storageBucket: "whattowatchtogether.firebasestorage.app",
        messagingSenderId: "748164363806",
        appId: "1:748164363806:web:5c1b8dd08310c43fa4a00f",
        measurementId: "G-YNMECW3GX7"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    let currentSessionId = null;
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

    // Скрыть все секции при загрузке
    elements.mainMenu.classList.add('hidden');
    elements.joinSection.classList.add('hidden');
    elements.sessionList.classList.add('hidden');
    elements.sessionView.classList.add('hidden');

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
            const sessionId = btoa(String(Math.random())).slice(0, 8); // Простой генератор ID
            const username = tg.initDataUnsafe.user?.username ? `@${tg.initDataUnsafe.user.username}` : `@user${tg.initDataUnsafe.user?.id || 'unknown'}`;
            await db.collection('sessions').doc(sessionId).set({
                name: sessionName,
                lists: [],
                users: [username],
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            currentSessionId = sessionId;
            lists = [];
            localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
            elements.sessionNameInput.value = '';
            setupSessionView();
            tg.showAlert(`Сессия создана: ${currentSessionId}`);
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
            const doc = await db.collection('sessions').doc(sessionId).get();
            if (doc.exists) {
                const username = tg.initDataUnsafe.user?.username ? `@${tg.initDataUnsafe.user.username}` : `@user${tg.initDataUnsafe.user?.id || 'unknown'}`;
                await db.collection('sessions').doc(sessionId).update({
                    users: firebase.firestore.FieldValue.arrayUnion(username)
                });
                currentSessionId = sessionId;
                lists = doc.data().lists || [];
                localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
                setupSessionView();
                renderLists();
                tg.showAlert('Успешно присоединились к сессии');
            } else {
                throw new Error('Сессия не найдена');
            }
        } catch (error) {
            console.error('Ошибка присоединения:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
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
            await db.collection('sessions').doc(currentSessionId).update({
                lists: lists
            });
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
            await db.collection('sessions').doc(currentSessionId).update({
                lists: lists
            });
            renderLists();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
        }
    }

    async function deleteSession(sessionId) {
        try {
            await db.collection('sessions').doc(sessionId).delete();
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

    async function clearSessions() {
        try {
            const snapshot = await db.collection('sessions').get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            localStorage.removeItem(SESSION_STORAGE_KEY);
            currentSessionId = null;
            renderSessions();
            tg.showAlert('Все сессии удалены');
        } catch (error) {
            console.error('Ошибка очистки сессий:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
        }
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
        try {
            const snapshot = await db.collection('sessions').get();
            snapshot.forEach(doc => {
                const sessionId = doc.id;
                const data = doc.data();
                const sessionEl = document.createElement('div');
                sessionEl.className = 'list-item';

                const detailsEl = document.createElement('div');
                detailsEl.className = 'session-details';

                const textEl = document.createElement('span');
                textEl.textContent = data.name;

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

                const usersEl = document.createElement('div');
                usersEl.className = 'users-list';
                usersEl.textContent = `Пользователи: ${data.users.length > 0 ? data.users.join(', ') : 'Нет пользователей'}`;
                sessionEl.appendChild(detailsEl);
                sessionEl.appendChild(usersEl);

                elements.sessionsContainer.appendChild(sessionEl);
            });
        } catch (error) {
            console.error('Ошибка получения сессий:', error);
            tg.showAlert(`Ошибка: ${error.message}`);
        }
    }

    // Инициализация
    function initialize() {
        const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSessionId) {
            joinExistingSession(savedSessionId);
        } else if (tg.initDataUnsafe.start_param) {
            elements.sessionIdInput.value = tg.initDataUnsafe.start_param;
            joinExistingSession(tg.initDataUnsafe.start_param);
        } else {
            showMainMenu();
        }
    }

    initialize();
});