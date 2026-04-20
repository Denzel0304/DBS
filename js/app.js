// =============================================
// app.js — 앱 초기화 & 탭 전환
// (로컬 전용: 로그인/세션 분기 없이 스플래시 → 앱 진입)
// =============================================

let currentTab = 'todo';

document.addEventListener('DOMContentLoaded', async () => {
  await showApp();
});

// 앱 전체 초기화
async function bootApp() {
  await initStorage();
  initCalendar();
  initModal();
  initRepeat();
  initGesturePopup();
  initSearch();
  initWeekly();
  initSettings();
  initTabs();
  initTheme();
  initLightMode();
  loadTodos();
  initBackButton();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('date-bar-actions').style.visibility = 'visible';
    });
  });
}

// 스플래시 숨기고 앱 표시 (페이드 전환)
async function showApp() {
  const splash = document.getElementById('splash-screen');
  const app    = document.getElementById('app');

  // 앱 먼저 준비 (숨긴 상태로)
  app.style.display = '';
  app.style.opacity = '0';

  // 부트
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

// ── 라이트 모드 토글 ──
function initLightMode() {
  applyLogoMode();
  document.getElementById('lightmode-toggle').addEventListener('click', () => {
    // 컬러 테마 활성 시 토글 무시
    if (document.body.classList.contains('theme-active')) return;
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('lightmode', isLight ? '1' : '0');
    localStorage.setItem('app-theme', isLight ? 'light' : 'dark');
    applyLogoMode();
  });
}

function applyLogoMode() {
  const isLight = document.body.classList.contains('light-mode');
  const src = isLight ? 'logo1.png' : 'logo.png';
  const splashLogo = document.getElementById('splash-logo');
  if (splashLogo) splashLogo.src = src;
}

// ── 뒤로가기 처리 ──
function initBackButton() {
  history.replaceState({ page: 'base' }, '');
  history.pushState({ page: 'app' }, '');

  window.addEventListener('popstate', e => {
    if (e.state && e.state.page === 'base') {
      if (hasOpenPopup()) {
        closeTopPopup();
        history.pushState({ page: 'app' }, '');
      } else if (currentTab !== 'todo') {
        switchTab('todo');
        history.pushState({ page: 'app' }, '');
      }
    }
  });
}

function hasOpenPopup() {
  if (document.getElementById('theme-sheet')) return true;
  if (document.getElementById('stats-overlay')) return true;
  if (!document.getElementById('repeat-overlay').classList.contains('hidden')) return true;
  if (!document.getElementById('action-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('year-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('month-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('modal-overlay').classList.contains('hidden')) return true;
  if (!document.getElementById('checklist-overlay').classList.contains('hidden')) return true;
  if (!document.getElementById('repeat-edit-overlay').classList.contains('hidden')) return true;
  const importConfirm = document.getElementById('import-confirm-modal');
  if (importConfirm && !importConfirm.classList.contains('hidden')) return true;
  const importError = document.getElementById('import-error-modal');
  if (importError && !importError.classList.contains('hidden')) return true;
  if (document.getElementById('repeats-panel').classList.contains('open')) return true;
  if (document.getElementById('settings-panel').classList.contains('open')) return true;
  return false;
}

function closeTopPopup() {
  // import 모달은 다른 모달들 위에 떠 있으므로 가장 먼저 처리
  const importError = document.getElementById('import-error-modal');
  if (importError && !importError.classList.contains('hidden')) {
    importError.classList.add('hidden');
    return;
  }
  const importConfirm = document.getElementById('import-confirm-modal');
  if (importConfirm && !importConfirm.classList.contains('hidden')) {
    if (typeof cancelImport === 'function') cancelImport();
    else importConfirm.classList.add('hidden');
    return;
  }

  const statsOverlay = document.getElementById('stats-overlay');
  if (statsOverlay) { statsOverlay.remove(); return; }
  const themeSheet = document.getElementById('theme-sheet');
  if (themeSheet) {
    themeSheet.remove();
    document.getElementById('theme-sheet-overlay')?.remove();
    return;
  }
  if (!document.getElementById('checklist-overlay').classList.contains('hidden')) { closeChecklistModal(false); return; }
  if (!document.getElementById('repeat-edit-overlay').classList.contains('hidden')) { closeRepeatEditOverlay(); return; }
  if (!document.getElementById('repeat-overlay').classList.contains('hidden')) { document.getElementById('repeat-overlay').classList.add('hidden'); return; }
  if (!document.getElementById('action-popup').classList.contains('hidden')) { closeActionPopup(); return; }
  if (!document.getElementById('year-popup').classList.contains('hidden')) { closeYearPopup(); return; }
  if (!document.getElementById('month-popup').classList.contains('hidden')) { closeMonthPopup(); return; }
  if (!document.getElementById('modal-overlay').classList.contains('hidden')) { closeModal(); return; }
  if (document.getElementById('repeats-panel').classList.contains('open')) { closeRepeatsPanel(); return; }
  if (document.getElementById('settings-panel').classList.contains('open')) { closeSettingsPanelOnly(); return; }
}

function initTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'settings') return;
      switchTab(btn.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  if (tabName === 'todo')        { loadTodos(); updateMonthDots(); }
  else if (tabName === 'weekly') { weekOffset = 0; loadWeekly(); }
  else if (tabName === 'search') { setTimeout(() => document.getElementById('search-input').focus(), 200); }
}

function refreshCurrentTab() {
  if (currentTab === 'todo')        { loadTodos(); updateMonthDots(); }
  else if (currentTab === 'weekly') { loadWeekly(); }
}
