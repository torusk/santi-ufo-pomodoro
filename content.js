console.log('🛸 三体UFO吸引機: 高度文明モード');

let ufo = null;
let isFlying = false;
let isSucking = false;
let flightTimeout = null;

function createUFO() {
  if (ufo) return;
  ufo = document.createElement('img');
  ufo.src = chrome.runtime.getURL('ufo.png');
  ufo.style.cssText = `
    position: fixed;
    top: 20%;
    left: 80%;
    transform: translate(-50%, -50%);
    width: 100px;
    height: auto;
    z-index: 999999;
    pointer-events: none;
    transition: top 2s ease-in-out, left 2s ease-in-out;
  `;
  ufo.id = 'ufo-santi';
  document.body.appendChild(ufo);
}

// 偵察飛行：ランダムな点へ等速で移動し、数秒停止する
function startFlying() {
  if (isFlying || isSucking) return;
  isFlying = true;

  function moveToNextPoint() {
    if (!ufo || !isFlying || isSucking) return;
    
    const x = Math.random() * 80 + 10; // 10% ~ 90%
    const y = Math.random() * 80 + 10;
    
    ufo.style.left = `${x}%`;
    ufo.style.top = `${y}%`;
    
    // 2〜4秒ごとに次の地点へ
    flightTimeout = setTimeout(moveToNextPoint, 3000 + Math.random() * 2000);
  }
  
  moveToNextPoint();
}

function stopFlying() {
  isFlying = false;
  if (flightTimeout) clearTimeout(flightTimeout);
}

// 吸引：回転させず、無機質に高速回収
function startSucking() {
  if (isSucking) return;
  isSucking = true;
  stopFlying();

  if (!ufo) createUFO();

  // 吸引時は画面의 少し上部中央で静止
  ufo.style.transition = 'all 1s ease-in-out';
  ufo.style.left = '50%';
  ufo.style.top = '15%';

  setTimeout(suckElements, 1200);
}

function suckElements() {
  const targets = Array.from(document.querySelectorAll('body > *:not(#ufo-santi)'))
    .flatMap(el => {
      try { return [el, ...Array.from(el.querySelectorAll('*'))]; } catch(e) { return [el]; }
    })
    .filter(el => {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.id === 'ufo-santi') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

  targets.forEach((el, index) => {
    setTimeout(() => {
      if (!ufo) return;
      const ufoRect = ufo.getBoundingClientRect();
      const ufoX = ufoRect.left + ufoRect.width / 2;
      const ufoY = ufoRect.top + ufoRect.height / 2;
      const elRect = el.getBoundingClientRect();
      const elX = elRect.left + elRect.width / 2;
      const elY = elRect.top + elRect.height / 2;

      const dx = ufoX - elX;
      const dy = ufoY - elY;

      // 回転なし。直線的に加速して消える（シュンッという感じ）
      el.style.transition = 'all 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045)';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.01)`;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, index * 8); // さらなる高速回収
  });

  const waitTime = Math.min(targets.length * 8 + 1500, 7000);
  setTimeout(finishSuck, waitTime);
}

function finishSuck() {
  if (document.getElementById('ufo-break-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'ufo-break-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: #000; color: #fff; z-index: 9999999;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Courier New', Courier, monospace;
    opacity: 0; transition: opacity 2s;
    user-select: none; cursor: none;
  `;
  
  // 穏やかな2色の明滅
  const style = document.createElement('style');
  style.textContent = `
    @keyframes flicker {
      0%, 100% { color: #fff; opacity: 1; }
      50% { color: #666; opacity: 0.8; }
    }
    .santi-countdown {
      font-size: 15vw;
      letter-spacing: -0.5vw;
      animation: flicker 2s infinite ease-in-out;
    }
  `;
  document.head.appendChild(style);

  const timerEl = document.createElement('div');
  timerEl.className = 'santi-countdown';
  overlay.appendChild(timerEl);
  document.body.appendChild(overlay);

  let remaining = 300; // 5分

  function updateDisplay() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:00`;
  }

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(interval);
      location.reload();
    }
    updateDisplay();
  }, 1000);

  updateDisplay();
  setTimeout(() => overlay.style.opacity = '1', 100);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'showUFO') { createUFO(); startFlying(); }
  if (msg.action === 'suck') startSucking();
  if (msg.action === 'hideUFO') { stopFlying(); if(ufo) ufo.remove(); ufo = null; }
});
