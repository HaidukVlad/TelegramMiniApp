import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const tg = window.Telegram.WebApp;
  if (!tg) {
    alert('Telegram WebApp не инициализирован!');
    throw new Error('Telegram WebApp не инициализирован');
  }
  tg.expand();
  tg.ready();

  // Firebase конфиг
  const firebaseConfig = {
    apiKey: "AIzaSyA7eZyKVLL9AmPKjFlEsktb9EH2UUpZyco",
    authDomain: "whattowatchtogether.firebaseapp.com",
    projectId: "whattowatchtogether",
    storageBucket: "whattowatchtogether.firebasestorage.app",
    messagingSenderId: "748164363806",
    appId: "1:748164363806:web:5c1b8dd08310c43fa4a00f",
    measurementId: "G-YNMECW3GX7"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // тг ID пользователя
  const userId = tg.initDataUnsafe.user?.id?.toString() || 'unknown_user';

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
  };

  function hideAllSections() {
    elements.mainMenu.classList.add('hidden');
    elements.joinSection.classList.add('hidden');
    elements.sessionList.classList.add('hidden');
    elements.sessionView.classList.add('hidden');
  }

  // Текущая сессия
  let currentSessionId = null;
  let currentSessionData = null;

  // --- Функции управления сессиями ---

  async function createNewSession() {
    const name = elements.sessionNameInput.value.trim() || `Сессия ${new Date().toLocaleDateString('ru-RU')}`;
    elements.createBtn.disabled = true;
    elements.createBtn.textContent = 'Создание...';

    try {
      // UID сессии (8 символов base64)
      const sessionId = btoa(String(Math.random())).slice(0, 8);

      // Документ сессии в Firestore под userId в коллекции usersSessions
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", sessionId);

      // сессия с пустым списком
      await setDoc(sessionDocRef, {
        name,
        lists: [],
        created_at: serverTimestamp(),
      });

      currentSessionId = sessionId;
      currentSessionData = { name, lists: [] };
      elements.sessionNameInput.value = '';

      showSessionView();
      renderLists();
      await loadUserSessions();

      tg.showAlert(`Сессия создана: ${sessionId}`);
    } catch (e) {
      console.error('Ошибка создания сессии', e);
      tg.showAlert(`Ошибка создания: ${e.message}`);
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
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", sessionId);
      const docSnap = await getDoc(sessionDocRef);
      if (!docSnap.exists()) {
        throw new Error('Сессия не найдена');
      }

      currentSessionId = sessionId;
      currentSessionData = docSnap.data();

      showSessionView();
      renderLists();

      tg.showAlert('Успешно присоединились к сессии');
    } catch (e) {
      console.error('Ошибка присоединения к сессии', e);
      tg.showAlert(`Ошибка: ${e.message}`);
    } finally {
      elements.joinSubmitBtn.disabled = false;
      elements.joinSubmitBtn.textContent = 'Присоединиться';
    }
  }

  async function loadUserSessions() {
    elements.sessionsContainer.innerHTML = 'Загрузка...';
    try {
      const sessionsCol = collection(db, "usersSessions", userId, "sessions");
      const snapshot = await getDocs(sessionsCol);

      elements.sessionsContainer.innerHTML = '';
      if (snapshot.empty) {
        elements.sessionsContainer.textContent = 'Сессии не найдены';
        return;
      }

      snapshot.forEach(docSnap => {
        const id = docSnap.id;
        const data = docSnap.data();

        const sessionEl = document.createElement('div');
        sessionEl.className = 'list-item';

        const detailsEl = document.createElement('div');
        detailsEl.className = 'session-details';

        const textEl = document.createElement('span');
        textEl.textContent = data.name;

        const btnJoin = document.createElement('button');
        btnJoin.className = 'btn btn-primary btn-small';
        btnJoin.textContent = 'Открыть';
        btnJoin.onclick = () => joinExistingSession(id);

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-secondary btn-small';
        btnDelete.textContent = 'Удалить';
        btnDelete.onclick = () => deleteSession(id);

        detailsEl.appendChild(textEl);
        detailsEl.appendChild(btnJoin);
        detailsEl.appendChild(btnDelete);
        sessionEl.appendChild(detailsEl);
        elements.sessionsContainer.appendChild(sessionEl);
      });

    } catch (e) {
      console.error('Ошибка загрузки сессий', e);
      elements.sessionsContainer.textContent = 'Ошибка загрузки сессий';
      tg.showAlert(`Ошибка: ${e.message}`);
    }
  }

  async function deleteSession(sessionId) {
    if (!sessionId) return;
    if (!confirm('Удалить эту сессию?')) return;

    try {
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", sessionId);
      await deleteDoc(sessionDocRef);

      if (sessionId === currentSessionId) {
        currentSessionId = null;
        currentSessionData = null;
      }
      await loadUserSessions();
      showMainMenu();
      tg.showAlert('Сессия удалена');
    } catch (e) {
      console.error('Ошибка удаления сессии', e);
      tg.showAlert(`Ошибка: ${e.message}`);
    }
  }

  // --- Управление списком в сессии ---

  async function addNewItem() {
    const item = elements.newItemInput.value.trim();
    if (!item) {
      tg.showAlert('Введите текст элемента');
      return;
    }
    if (!currentSessionId) return;

    elements.addBtn.disabled = true;
    elements.addBtn.textContent = 'Добавление...';

    try {
      currentSessionData.lists.push(item);

      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", currentSessionId);
      await updateDoc(sessionDocRef, { lists: currentSessionData.lists });

      elements.newItemInput.value = '';
      renderLists();
    } catch (e) {
      console.error('Ошибка добавления элемента', e);
      tg.showAlert(`Ошибка: ${e.message}`);
    } finally {
      elements.addBtn.disabled = false;
      elements.addBtn.textContent = 'Добавить';
    }
  }

  async function deleteItem(index) {
    if (!currentSessionId) return;
    currentSessionData.lists.splice(index, 1);

    try {
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", currentSessionId);
      await updateDoc(sessionDocRef, { lists: currentSessionData.lists });
      renderLists();
    } catch (e) {
      console.error('Ошибка удаления элемента', e);
      tg.showAlert(`Ошибка: ${e.message}`);
    }
  }

  function renderLists() {
    elements.listsContainer.innerHTML = '';
    if (!currentSessionData?.lists?.length) {
      elements.listsContainer.textContent = 'Список пуст';
      return;
    }

    currentSessionData.lists.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'list-item';

      const span = document.createElement('span');
      span.textContent = item;

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn btn-secondary btn-small';
      btnDelete.textContent = 'Удалить';
      btnDelete.onclick = () => deleteItem(idx);

      div.appendChild(span);
      div.appendChild(btnDelete);
      elements.listsContainer.appendChild(div);
    });
  }

  // --- UI переходы ---

  function showMainMenu() {
    hideAllSections();
    elements.mainMenu.classList.remove('hidden');
    currentSessionId = null;
    currentSessionData = null;
  }

  function showJoinSection() {
    hideAllSections();
    elements.joinSection.classList.remove('hidden');
  }

  async function showSessionList() {
    hideAllSections();
    elements.sessionList.classList.remove('hidden');
    await loadUserSessions();
  }

  function showSessionView() {
    hideAllSections();
    elements.sessionView.classList.remove('hidden');
    elements.currentSessionIdSpan.textContent = currentSessionId || '';
    renderLists();
  }

  elements.createBtn.onclick = createNewSession;
  elements.joinBtn.onclick = showJoinSection;
  elements.listBtn.onclick = showSessionList;
  elements.joinSubmitBtn.onclick = () => joinExistingSession();
  elements.backBtn.onclick = showMainMenu;
  elements.listBackBtn.onclick = showMainMenu;
  elements.sessionBackBtn.onclick = showMainMenu;
  elements.copyBtn.onclick = () => {
    if (!currentSessionId) return;
    navigator.clipboard.writeText(currentSessionId);
    tg.showAlert('ID сессии скопирован!');
  };
  elements.addBtn.onclick = addNewItem;

  // --- Инициализация ---

  (async function initialize() {showMainMenu();})();
});
