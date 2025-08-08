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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram.WebApp;
  if (!tg) {
    alert("Telegram WebApp не инициализирован!");
    throw new Error("Telegram WebApp не инициализирован");
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
    measurementId: "G-YNMECW3GX7",
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // тг ID пользователя
  const userId = tg.initDataUnsafe.user?.id?.toString() || "unknown_user";

  // DOM элементы
  const elements = {
    mainMenu: document.getElementById("main_menu"),
    joinSection: document.getElementById("join_session"),
    sessionList: document.getElementById("session_list"),
    sessionView: document.getElementById("session_view"),
    createBtn: document.getElementById("create_btn"),
    joinBtn: document.getElementById("join_btn"),
    listBtn: document.getElementById("list_btn"),
    joinSubmitBtn: document.getElementById("join_submit_btn"),
    backBtn: document.getElementById("back_btn"),
    listBackBtn: document.getElementById("list_back_btn"),
    sessionBackBtn: document.getElementById("session_back_btn"),
    sessionIdInput: document.getElementById("session_id_input"),
    currentSessionIdSpan: document.getElementById("current_session_id"),
    copyBtn: document.getElementById("copy_btn"),
    listsContainer: document.getElementById("lists_container"),
    sessionsContainer: document.getElementById("sessions_container"),
    newItemInput: document.getElementById("new_item"),
    addBtn: document.getElementById("add_btn"),
    sessionNameInput: document.getElementById("session_name_input"),
    clearSessionsBtn: document.getElementById("clear_sessions_btn"),
    toastContainer: document.getElementById("toast_container"),
  };

  function hideAllSections() {
    elements.mainMenu.classList.add("hidden");
    elements.joinSection.classList.add("hidden");
    elements.sessionList.classList.add("hidden");
    elements.sessionView.classList.add("hidden");
  }

  // Текущая сессия
  let currentSessionId = null;
  let currentSessionData = null;

  // --- Функция показа toast уведомлений ---
  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // --- Функции управления сессиями ---

  async function createNewSession() {
    const name =
      elements.sessionNameInput.value.trim() ||
      `Сессия ${new Date().toLocaleDateString("ru-RU")}`;
    elements.createBtn.disabled = true;
    elements.createBtn.textContent = "Создание...";

    try {
      // Генерация UID сессии (8 символов base64)
      const sessionId = btoa(String(Math.random())).slice(0, 8);

      const sessionDocRef = doc(
        db,
        "usersSessions",
        userId,
        "sessions",
        sessionId
      );

      await setDoc(sessionDocRef, {
        name,
        lists: [],
        created_at: serverTimestamp(),
      });

      currentSessionId = sessionId;
      currentSessionData = { name, lists: [] };
      elements.sessionNameInput.value = "";

      showSessionView();
      renderLists();
      await loadUserSessions();

      showToast(`Сессия создана: ${sessionId}`);
    } catch (e) {
      console.error("Ошибка создания сессии", e);
      showToast(`Ошибка создания: ${e.message}`);
    } finally {
      elements.createBtn.disabled = false;
      elements.createBtn.textContent = "Создать комнату";
    }
  }

  async function joinExistingSession(sessionId = elements.sessionIdInput.value.trim()) {
    if (!sessionId) {
      showToast("Введите ID сессии");
      return;
    }

    elements.joinSubmitBtn.disabled = true;
    elements.joinSubmitBtn.textContent = "Присоединение...";

    try {
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", sessionId);
      const docSnap = await getDoc(sessionDocRef);
      if (!docSnap.exists()) {
        throw new Error("Сессия не найдена");
      }

      currentSessionId = sessionId;
      currentSessionData = docSnap.data();

      showSessionView();
      renderLists();

      showToast("Успешно присоединились к сессии");
    } catch (e) {
      console.error("Ошибка присоединения к сессии", e);
      showToast(`Ошибка: ${e.message}`);
    } finally {
      elements.joinSubmitBtn.disabled = false;
      elements.joinSubmitBtn.textContent = "Присоединиться";
    }
  }

  async function loadUserSessions() {
    elements.sessionsContainer.textContent = "Загрузка...";
    try {
      const sessionsCol = collection(db, "usersSessions", userId, "sessions");
      const snapshot = await getDocs(sessionsCol);

      elements.sessionsContainer.innerHTML = "";
      if (snapshot.empty) {
        elements.sessionsContainer.textContent = "Сессии не найдены";
        return;
      }

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();

        const sessionEl = document.createElement("div");
        sessionEl.className = "list-item";

        const textEl = document.createElement("span");
        textEl.textContent = data.name;

        const btnJoin = document.createElement("button");
        btnJoin.className = "btn btn-primary btn-small";
        btnJoin.textContent = "Открыть";
        btnJoin.onclick = () => joinExistingSession(id);

        const btnDelete = document.createElement("button");
        btnDelete.className = "btn btn-secondary btn-small";
        btnDelete.textContent = "Удалить";
        btnDelete.onclick = () => deleteSession(id);

        sessionEl.appendChild(textEl);
        sessionEl.appendChild(btnJoin);
        sessionEl.appendChild(btnDelete);
        elements.sessionsContainer.appendChild(sessionEl);
      });
    } catch (e) {
      console.error("Ошибка загрузки сессий", e);
      elements.sessionsContainer.textContent = "Ошибка загрузки сессий";
      showToast(`Ошибка: ${e.message}`);
    }
  }

  async function deleteSession(sessionId) {
    if (!sessionId) return;
    if (!confirm("Удалить эту сессию?")) return;

    try {
      const sessionDocRef = doc(db, "usersSessions", userId, "sessions", sessionId);
      await deleteDoc(sessionDocRef);

      if (sessionId === currentSessionId) {
        currentSessionId = null;
        currentSessionData = null;
      }
      await loadUserSessions();
      showMainMenu();
      showToast("Сессия удалена");
    } catch (e) {
      console.error("Ошибка удаления сессии", e);
      showToast(`Ошибка: ${e.message}`);
    }
  }

  async function clearAllSessions() {
    if (!confirm("Удалить все сессии? Это действие необратимо.")) return;

    try {
      const sessionsCol = collection(db, "usersSessions", userId, "sessions");
      const snapshot = await getDocs(sessionsCol);
      const promises = [];
      snapshot.forEach((docSnap) => {
        promises.push(deleteDoc(doc(db, "usersSessions", userId, "sessions", docSnap.id)));
      });
      await Promise.all(promises);
      showToast("Все сессии удалены");
      await loadUserSessions();
      showMainMenu();
    } catch (e) {
      console.error("Ошибка очистки сессий", e);
      showToast(`Ошибка: ${e.message}`);
    }
  }

  // --- Работа с элементами в сессии ---

  async function renderLists() {
    elements.listsContainer.innerHTML = "";
    if (!currentSessionData || !currentSessionData.lists) return;

    currentSessionData.lists.forEach((list, i) => {
      const listDiv = document.createElement("div");
      listDiv.className = "list-block";

      const title = document.createElement("h3");
      title.textContent = list.name || "Без имени";
      listDiv.appendChild(title);

      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.paddingLeft = 0;

      list.items.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "list-item";

        const span = document.createElement("span");
        span.textContent = item;
        li.appendChild(span);

        const btnDelete = document.createElement("button");
        btnDelete.className = "btn btn-secondary btn-small";
        btnDelete.textContent = "Удалить";
        btnDelete.onclick = () => {
          removeItemFromList(i, idx);
        };
        li.appendChild(btnDelete);

        ul.appendChild(li);
      });

      listDiv.appendChild(ul);
      elements.listsContainer.appendChild(listDiv);
    });
  }

  async function addItemToList() {
    const val = elements.newItemInput.value.trim();
    if (!val) {
      showToast("Введите название элемента");
      return;
    }
    if (!currentSessionData) {
      showToast("Сначала откройте сессию");
      return;
    }

    // По умолчанию добавляем в первый список, если нет списков — создаём
    if (!currentSessionData.lists.length) {
      currentSessionData.lists.push({ name: "Список 1", items: [] });
    }

    currentSessionData.lists[0].items.push(val);

    await updateSessionData(currentSessionData);
    elements.newItemInput.value = "";
    renderLists();
    showToast("Элемент добавлен");
  }

  async function removeItemFromList(listIndex, itemIndex) {
    if (
      !currentSessionData ||
      !currentSessionData.lists[listIndex] ||
      currentSessionData.lists[listIndex].items.length <= itemIndex
    )
      return;

    currentSessionData.lists[listIndex].items.splice(itemIndex, 1);
    await updateSessionData(currentSessionData);
    renderLists();
    showToast("Элемент удалён");
  }

  async function updateSessionData(data) {
    if (!currentSessionId) return;
    const sessionDocRef = doc(db, "usersSessions", userId, "sessions", currentSessionId);
    try {
      await updateDoc(sessionDocRef, { lists: data.lists });
    } catch (e) {
      console.error("Ошибка обновления сессии", e);
      showToast(`Ошибка обновления: ${e.message}`);
    }
  }

  // --- UI переключение ---

  function showMainMenu() {
    hideAllSections();
    elements.mainMenu.classList.remove("hidden");
  }

  function showJoinSection() {
    hideAllSections();
    elements.joinSection.classList.remove("hidden");
    elements.sessionIdInput.value = "";
  }

  function showSessionList() {
    hideAllSections();
    elements.sessionList.classList.remove("hidden");
    loadUserSessions();
  }

  function showSessionView() {
    hideAllSections();
    elements.sessionView.classList.remove("hidden");
    elements.currentSessionIdSpan.textContent = currentSessionId;
    renderLists();
  }

  // --- События ---

  elements.createBtn.onclick = createNewSession;
  elements.joinBtn.onclick = showJoinSection;
  elements.listBtn.onclick = showSessionList;

  elements.backBtn.onclick = showMainMenu;
  elements.listBackBtn.onclick = showMainMenu;
  elements.sessionBackBtn.onclick = () => {
    currentSessionId = null;
    currentSessionData = null;
    showMainMenu();
  };

  elements.joinSubmitBtn.onclick = () => joinExistingSession();
  elements.copyBtn.onclick = () => {
    if (!currentSessionId) return;
    navigator.clipboard.writeText(currentSessionId).then(() => {
      showToast("ID сессии скопирован");
    });
  };

  elements.addBtn.onclick = addItemToList;
  elements.clearSessionsBtn.onclick = clearAllSessions;

  // Показываем главное меню по умолчанию
  showMainMenu();
});
