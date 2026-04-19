// =============================================
// storage.js — IndexedDB 로컬 저장소
// (단일 기기 로컬 전용. 동기화/큐/Realtime 없음)
// =============================================

const IDB_NAME    = 'ddog-cache';
const IDB_VERSION = 1;
const STORE_TODOS = 'todos';

let idb = null;

// ── IndexedDB 초기화 ──
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_TODOS)) {
        db.createObjectStore(STORE_TODOS, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function getIDB() {
  if (!idb) idb = await openIDB();
  return idb;
}

// ── IDB CRUD ──

async function idbGetAll() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readonly');
    const req = tx.objectStore(STORE_TODOS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(id) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readonly');
    const req = tx.objectStore(STORE_TODOS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(todo) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).put(todo);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbPutMany(todos) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_TODOS, 'readwrite');
    const store = tx.objectStore(STORE_TODOS);
    todos.forEach(t => store.put(t));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbDelete(id) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── 앱 시작 시 호출 ──
async function initStorage() {
  await getIDB();
}
