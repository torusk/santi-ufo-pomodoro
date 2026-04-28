console.log('🛸 三体UFO吸引機: 稼働開始');

let ufo = null;
let isFlying = false;
let isSucking = false;
let flightTimeout = null;

function createUFO() {
  if (ufo) return;
  ufo = document.createElement('img');
  ufo.src = chrome.runtime.getURL('ufo.png');
  ufo.id = 'ufo-santi';
  ufo.style.cssText = `
    position: fixed;
    top: 20%;
    left: 80%;
    transform: translate(-50%, -50%);
    width: 100px;
    height: auto;
    z-index: 2147483647;
    pointer-events: none;
    transition: top 2s ease-in-out, left 2s ease-in-out;
  `;
  document.documentElement.appendChild(ufo);
}

function startFlying() {
  if (isFlying || isSucking) return;
  isFlying = true;

  function moveToNextPoint() {
    if (!ufo || !isFlying || isSucking) return;
    const x = Math.random() * 80 + 10;
    const y = Math.random() * 80 + 10;
    ufo.style.left = `${x}%`;
    ufo.style.top = `${y}%`;
    flightTimeout = setTimeout(moveToNextPoint, 3000 + Math.random() * 2000);
  }
  moveToNextPoint();
}

function stopFlying() {
  isFlying = false;
  if (flightTimeout) clearTimeout(flightTimeout);
}

function startSucking() {
  if (isSucking) return;
  isSucking = true;
  stopFlying();
  if (!ufo) createUFO();
  ufo.style.transition = 'all 1s ease-in-out';
  ufo.style.left = '50%';
  ufo.style.top = '15%';
  setTimeout(suckElements, 1200);
}

function suckElements() {
  // 安定性のためのリファクタリング:
  // 1. セレクタをシンプルにし、CSPに触れるstyleタグを排除。
  // 2. 処理対象を「目に見える主要な要素」に絞り、最大500個に制限。
  const targets = Array.from(document.querySelectorAll('p, li, img, h1, h2, h3, h4, h5, h6, pre, code, blockquote, input, button, a'))
    .filter(el => {
      try {
        if (el.closest('#ufo-santi')) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 2 && rect.height > 2 && rect.top < window.innerHeight * 1.5;
      } catch (e) { return false; }
    })
    .sort((a, b) => {
      const rA = a.getBoundingClientRect();
      const rB = b.getBoundingClientRect();
      return (rB.top + rB.height) - (rA.top + rA.height);
    })
    .slice(0, 500);

  targets.forEach((el, index) => {
    setTimeout(() => {
      if (!ufo) return;
      try {
        const ufoRect = ufo.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const ufoX = ufoRect.left + ufoRect.width / 2;
        const ufoY = ufoRect.top + ufoRect.height / 2;
        const elX = elRect.left + elRect.width / 2;
        const elY = elRect.top + elRect.height / 2;

        // transformを有効にするための処理
        if (window.getComputedStyle(el).display === 'inline') {
          el.style.display = 'inline-block';
        }

        el.style.transition = 'all 0.6s cubic-bezier(0.6, -0.2, 0.8, 0.05)';
        el.style.transform = `translate(${ufoX - elX}px, ${ufoY - elY}px) scale(0.01) rotate(${Math.random() * 40 - 20}deg)`;
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } catch (e) { }
    }, index * 15);
  });

  const waitTime = Math.max(targets.length * 15 + 2000, 3000);
  setTimeout(finishSuck, waitTime);
}

function finishSuck() {
  if (document.getElementById('ufo-break-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'ufo-break-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: #000; color: #fff; z-index: 2147483647;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Courier New', Courier, monospace;
    opacity: 0; transition: opacity 2s;
    user-select: none; cursor: none;
  `;
  
  const timerEl = document.createElement('div');
  timerEl.style.cssText = `
    font-size: 15vw;
    letter-spacing: -0.5vw;
  `;
  overlay.appendChild(timerEl);
  document.documentElement.appendChild(overlay);

  // Web Animations APIを使用してCSPエラーを回避
  timerEl.animate([
    { color: '#fff', opacity: 1 },
    { color: '#666', opacity: 0.8 },
    { color: '#fff', opacity: 1 }
  ], {
    duration: 2000,
    iterations: Infinity,
    easing: 'ease-in-out'
  });

  let remaining = 300; 

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
