// =============================================
// sound.js — 효과음 재생
// =============================================

const _sfxComplete = new Audio();
_sfxComplete.src = (function() {
  // index.html 기준 루트 경로로 고정
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].src;
    if (src && src.includes('sound.js')) {
      return src.replace(/js\/sound\.js.*$/, 'effect 1.mp3');
    }
  }
  return 'effect 1.mp3';
})();
_sfxComplete.volume = 0.7;
_sfxComplete.preload = 'auto';

let _audioUnlocked = false;

// ── iOS 판별 ──
// iOS Safari는 AudioContext 언락이 필요하며,
// Audio.play()→pause() 언락 시 volume=0 처리가 필수
const _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// ── AudioContext (iOS 전용 보조 언락) ──
// iOS는 AudioContext.resume()이 사용자 인터랙션 핸들러 내에서 호출되어야
// 이후 Audio 재생이 안정적으로 허용됨
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {}
  }
  return _audioCtx;
}

function _unlockAudio() {
  if (_audioUnlocked) return;

  if (_isIOS) {
    // ── iOS 전용 언락 ──
    // 1) AudioContext를 resume하여 Web Audio 스택 활성화
    const ctx = _getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // 2) Audio 언락: 반드시 volume=0으로 재생 후 즉시 pause
    //    volume=0.7인 채로 play()하면 iOS에서 실제 소리가 새어나옴
    const prevVolume = _sfxComplete.volume;
    _sfxComplete.volume = 0;
    _sfxComplete.play().then(() => {
      _sfxComplete.pause();
      _sfxComplete.currentTime = 0;
      _sfxComplete.volume = prevVolume; // 원래 볼륨 복원
      _audioUnlocked = true;
    }).catch(() => {
      // 실패 시 볼륨만 복원, 다음 인터랙션에서 재시도
      _sfxComplete.volume = prevVolume;
    });

  } else {
    // ── Android / Desktop: 기존 방식 그대로 ──
    _sfxComplete.play().then(() => {
      _sfxComplete.pause();
      _sfxComplete.currentTime = 0;
      _audioUnlocked = true;
    }).catch(() => {
      // 실패해도 다음 인터랙션에서 재시도할 수 있도록 플래그 세우지 않음
    });
  }
}

document.addEventListener('touchstart', _unlockAudio, { passive: true });
document.addEventListener('mousedown',  _unlockAudio);

function playCompleteSound() {
  try {
    _sfxComplete.currentTime = 0;
    _sfxComplete.play().catch(() => {});
  } catch(e) {}
}
