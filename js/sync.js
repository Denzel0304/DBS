// =============================================
// sync.js — 로컬 저장소(IndexedDB) 전용
// 서버 동기화 없음. 모든 데이터는 이 기기 브라우저에만 저장됨.
// 저장 이름은 전용 접두어(APP_NS)를 사용 → 다른 앱과 절대 겹치지 않음
// =============================================

const IDB_NAME    = APP_NS + 'db';
const IDB_VERSION = 1;
const STORE_TODOS = APP_NS + 'todos';

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

// ── IDB CRUD helpers ──

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

// 이 앱 전용 저장소(STORE_TODOS)만 비움 — 다른 DB/앱에는 영향 없음 (백업 복원용)
async function idbClear() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// 백업 복원: 전체 교체를 한 트랜잭션으로 처리 (중간에 실패하면 아무것도 바뀌지 않음)
async function idbReplaceAll(todos) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_TODOS, 'readwrite');
    const store = tx.objectStore(STORE_TODOS);
    store.clear();
    todos.forEach(t => store.put(t));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error || new Error('복원 트랜잭션 중단'));
  });
}

// ── 고유 ID 생성 (UUID v4) ──
function genId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch(e) {}
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ── 앱 시작 시 호출 ──
async function initLocalStore() {
  await getIDB();
}
