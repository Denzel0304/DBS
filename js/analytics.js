// =============================================
// analytics.js — 사용 로그 전송 (자가 실행)
// 본 앱 코드와 완전 분리. 이 파일을 통째로 지워도 앱 동작에 영향 없음.
// =============================================

(function() {
  // ── 설정 ──
  // GAS 웹앱 배포 URL을 여기에 붙여넣기
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxoXsFV0vpZsiri2zSxmq5D8pBfY5yUh8JgH0I1I5jR46SREfdA4K-GgUsoFvVd9aFW/exec';

  // localStorage에 저장할 디바이스 ID 키
  const DEVICE_ID_KEY = 'ddog_device_id';

  // ── 디바이스 ID 발급/조회 ──
  function getDeviceId() {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      // localStorage 접근 불가(시크릿 모드 등) 시 임시 ID
      return 'temp-' + Date.now();
    }
  }

  // ── 로그 전송 (fire-and-forget) ──
  function sendLog() {
    // GAS URL이 미설정이면 조용히 종료
    if (!GAS_URL || GAS_URL.indexOf('배포후받은_URL') !== -1) return;

    try {
      const payload = JSON.stringify({
        device_id: getDeviceId(),
        timestamp: new Date().toISOString()
      });

      // no-cors + text/plain 방식: GAS는 e.postData.contents로 JSON 문자열 그대로 받음
      // 응답을 못 읽지만 어차피 fire-and-forget이라 무관
      fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        keepalive: true  // 페이지 떠나도 전송 보장
      }).catch(() => {
        // 네트워크 오류 무시 — 로그 전송 실패가 앱에 영향을 주면 안 됨
      });
    } catch (e) {
      // 어떠한 예외도 본 앱에 전파되지 않도록 차단
    }
  }

  // ── 페이지 로드 즉시 자동 실행 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendLog);
  } else {
    sendLog();
  }
})();
