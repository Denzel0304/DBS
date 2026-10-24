// =============================================
// config.js — 앱 전용 이름공간 & 전역 상태
// =============================================

// 이 앱 전용 저장 이름 접두어
// IndexedDB 이름, localStorage 키 등 이 앱이 저장하는 모든 이름 앞에 붙음
// → 같은 주소(도메인)의 다른 앱과 저장 공간이 절대 겹치지 않음
const APP_NS = 'zq7k39xr_';

// 스플래시 숨기고 앱 표시 (페이드 전환)
async function showApp() {
  const splash = document.getElementById('splash-screen');
  const app    = document.getElementById('app');

  // 앱 먼저 준비 (숨긴 상태로)
  app.style.display = '';
  app.style.opacity = '0';

  // bootApp 실행
  await bootApp();

  // 스플래시 페이드아웃, 앱 페이드인
  if (splash) { splash.style.transition = 'opacity 0.3s'; splash.style.opacity = '0'; }
  app.style.transition = 'opacity 0.3s';
  app.style.opacity = '1';

  setTimeout(() => {
    if (splash) splash.style.display = 'none';
    app.style.transition = '';
    app.style.opacity = '';
  }, 320);
}

// 전역 앱 상태
const AppState = {
  selectedDate: toLocalDateStr(new Date()),
  calYear:  new Date().getFullYear(),
  calMonth: new Date().getMonth() + 1,
  todos: [],
  dotDates: new Set(),
  pastUndoneDates: new Set(),
  editingId: null,
};

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr()    { return toLocalDateStr(new Date()); }

function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return toLocalDateStr(d);
}

function daysBeforeStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() - n); return toLocalDateStr(d);
}

function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}
