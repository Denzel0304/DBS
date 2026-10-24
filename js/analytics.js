// =============================================
// analytics.js — 사용 로그 신호 전송 (똑비서)
// 앱을 열 때 1번, GAS로 기기ID + 시간만 보냄
// 시트 기록·월별 집계는 모두 GAS가 처리 ('똑비서 log' / '똑비서 월별')
// 전송 실패·오프라인이어도 앱 동작에는 영향 없음
// =============================================
(function () {
  var LOG_URL = 'https://script.google.com/macros/s/AKfycbxoXsFV0vpZsiri2zSxmq5D8pBfY5yUh8JgH0I1I5jR46SREfdA4K-GgUsoFvVd9aFW/exec';

  var NS         = (typeof APP_NS !== 'undefined') ? APP_NS : 'zq7k39xr_';
  var KEY_DEVICE = NS + 'device_id';     // 기기 고유ID (영구 저장)
  var KEY_SENT   = NS + 'log_sent';      // 이번 실행에서 이미 보냈는지 (탭/앱을 닫으면 사라짐)

  // ── 기기ID 생성 (UUID v4) ──
  function makeId() {
    try {
      if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    } catch (e) {
      return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
  }

  // ── 기기ID 불러오기 (없으면 새로 만들어 저장) ──
  function getDeviceId() {
    try {
      var id = localStorage.getItem(KEY_DEVICE);
      if (!id) {
        id = makeId();
        localStorage.setItem(KEY_DEVICE, id);
      }
      return id;
    } catch (e) {
      return makeId();
    }
  }

  function sendLog() {
    try {
      // 습관·디데이 등 하위 화면에서 돌아올 때 중복 전송 방지
      try {
        if (sessionStorage.getItem(KEY_SENT) === '1') return;
        sessionStorage.setItem(KEY_SENT, '1');
      } catch (e) {}

      var payload = JSON.stringify({
        app: 'ddok',
        device_id: getDeviceId(),
        timestamp: new Date().toISOString()
      });

      // text/plain + no-cors → GAS 호출 시 CORS 문제 없음 (응답은 읽지 않음, 신호만 보냄)
      fetch(LOG_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // 앱 로딩을 방해하지 않도록, 페이지 로드가 끝난 뒤 전송
  if (document.readyState === 'complete') {
    setTimeout(sendLog, 1000);
  } else {
    window.addEventListener('load', function () { setTimeout(sendLog, 1000); });
  }
})();
