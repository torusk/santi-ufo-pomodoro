// content.js
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

  // 吸引時は画面の少し上部中央で静止
  ufo.style.transition = 'all 1s ease-in-out';
  ufo.style.left = '50%';
  ufo.style.top = '15%';

  setTimeout(suckElements, 1200);
}

function suckElements() {
  // 全ての要素を取得（UFO自体とその中身は除外）
  const allElements = Array.from(document.querySelectorAll('body *:not(#ufo-santi):not(#ufo-santi *)'));
  
  const targets = allElements.filter(el => {
    // 既に透明なものや、スクリプト、スタイル、面積がないものは除外
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    
    // 子要素にターゲットとなる要素を持っていない（末端の要素）か、特定の重要タグを優先
    const hasText = el.innerText && el.innerText.trim().length > 0;
    const isLeaf = el.children.length === 0;
    const isMedia = el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'SVG' || el.tagName === 'CANVAS';
    
    return isLeaf || isMedia || (hasText && el.children.length < 5); // 複雑すぎる親要素は避ける
  });

  // 下にある要素から順に吸い上げる
  targets.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    return (rectB.top + rectB.height) - (rectA.top + rectA.height);
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

      el.style.transition = 'all 0.8s cubic-bezier(0.5, 0, 0.75, 0)';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.1) rotate(${Math.random() * 60 - 30}deg)`;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, index * 40); // 40ms間隔
  });

  const waitTime = Math.max(targets.length * 40 + 2000, 3000);
  setTimeout(finishSuck, waitTime);
}

function finishSuck() {
  if (document.getElementById('ufo-break-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'ufo-break-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: #000; color: #fff; z-index: 9999999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-size: 1.5rem; opacity: 0; transition: opacity 1s;
    font-family: sans-serif;
  `;
  overlay.innerHTML = `
    <p style="letter-spacing: 0.2rem;">归零处理完成</p>
    <button id="ufo-reload-btn" style="margin-top:2rem; padding:0.5rem 1.5rem; background:transparent; color:#fff; border:1px solid #555; cursor:pointer;">重构</button>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 100);
  document.getElementById('ufo-reload-btn').onclick = () => location.reload();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'showUFO') { createUFO(); startFlying(); }
  if (msg.action === 'suck') startSucking();
  if (msg.action === 'hideUFO') { stopFlying(); if(ufo) ufo.remove(); ufo = null; }
});