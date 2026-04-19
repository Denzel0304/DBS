// =============================================
// config.js — 전역 상태 & 공통 유틸
// (로컬 전용: 인증/Supabase 관련 로직 모두 제거)
// =============================================

// ── 날짜 유틸 ──
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() { return toLocalDateStr(new Date()); }

function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return toLocalDateStr(d);
}

function daysBeforeStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() - n); return toLocalDateStr(d);
}

// ── UUID 생성 (모든 신규 행의 id) ──
function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 매우 오래된 브라우저용 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ── 토스트 ──
function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── 전역 앱 상태 ──
const AppState = {
  selectedDate: toLocalDateStr(new Date()),
  calYear:  new Date().getFullYear(),
  calMonth: new Date().getMonth() + 1,
  todos: [],
  dotDates: new Set(),
  pastUndoneDates: new Set(),
  editingId: null,
};
