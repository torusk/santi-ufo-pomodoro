それでは、仕様書 → 完全なコードの順でお届けします。  
いただいた `ufo.png` をフォルダに置くだけで、すぐに試せるようにしてあります。

---

## 🛸 仕様書：三体UFOポモドーロ吸引機

### 1. 概要
ブラウザの全要素をUFOが吸い上げて強制終了させる、『三体』コンセプトのChrome拡張。  
設定した時間（1〜59分）が経過すると、画面上のDOMが次々とUFOへ吸い込まれ、最終的に休憩画面が表示される。  
時間管理はポモドーロタイマー方式。

### 2. ユーザーインターフェース（ポップアップ）
- **タイマー時間選択**  
  `<select>` で1〜59分から選択（デフォルト25分）。  
- **残り時間表示**  
  `MM:SS` 形式でリアルタイム更新。  
- **スタート / ストップボタン**  
  開始・中断・リセット操作。  
- **いますぐ吸い上げボタン**  
  タイムアップを待たずに吸引を強制発動。

### 3. タイマーの仕組み
- `chrome.alarms` API でバックグラウンド管理（Manifest V3）。  
- 開始時にアクティブタブのIDを保存し、カウントダウン終了時に対象タブへメッセージ送信。  
- タブが閉じられている場合は何もしない（エラー吸収）。

### 4. UFOの動作（content.js）
- **タイマー起動で画像を固定表示**  
  `position: fixed` + 高 `z-index`。  
  `requestAnimationFrame` でランダム方向に浮遊。  
- **吸引開始シグナル受信 → 吸引シーケンスに移行**  
  全DOM要素（UFO自身除く）へアニメーション適用。  
  `transform: scale(0)` + UFO座標への平行移動。  
  要素ごとに50msずつ遅延 → 吸い込まれる感演出。  
- **吸引完了後に休憩オーバーレイ**  
  全要素が消えたら「休憩時間」の黒背景フルスクリーン表示。  
  10秒後に自動リロード、または「仕切り直し」ボタンで即リロード。

### 5. 権限・制約
- **Manifest V3** 準拠。  
- パーミッション：`storage`, `alarms`, `activeTab`（メッセージング用に実質的には必要だが、`tabs` 権限は必須プログラム的な制御のため不要。ただしタブID取得のため `tabs` を入れてもいいが、`activeTab` で十分。今回は `tabs` を明示的に追加する必要はないが、`chrome.tabs.query` を使うのでホストパーミッション `activeTab` で問題ない。実際には `tabs` 権限なしでもアクティブタブは取得可能）。`scripting` は使わない。 
- `web_accessible_resources` に `ufo.png` を指定。

### 6. ファイル構成
```
santi-ufo-pomodoro/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── popup.css
└── ufo.png   ← あなたが用意した絵
```

---

## 💻 完全なコード

### `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "三体UFO吸引機",
  "version": "1.0",
  "description": "UFOがブラウザのすべてを吸い上げるポモドーロタイマー。",
  "permissions": ["storage", "alarms", "activeTab"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "UFO吸引機"
  },
  "web_accessible_resources": [
    {
      "resources": ["ufo.png"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### `background.js`（タイマー中枢）
```javascript
// 定数
const ALARM_NAME = 'ufo-suck-timer';
const STORAGE_KEY = 'timerData'; // { tabId, endTime }

// アラーム生成
function startAlarm(minutes, tabId) {
  const delayInMinutes = Math.max(1, Math.min(59, minutes));
  chrome.alarms.create(ALARM_NAME, { delayInMinutes });
  // 開始情報を保存
  const endTime = Date.now() + delayInMinutes * 60 * 1000;
  chrome.storage.local.set({ [STORAGE_KEY]: { tabId, endTime } });
}

// アラーム停止
function stopAlarm() {
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      chrome.storage.local.remove(STORAGE_KEY);
    }
  });
}

// アラーム発火 → タブへ吸引指令
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const timerData = data.timerData;
    if (!timerData) return;

    chrome.tabs.get(timerData.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        // タブが存在しない
        chrome.storage.local.remove(STORAGE_KEY);
        return;
      }
      // コンテントスクリプトに吸い上げ命令
      chrome.tabs.sendMessage(tab.id, { action: 'suck' }).catch(() => {});
    });

    // ストレージクリア
    chrome.storage.local.remove(STORAGE_KEY);
  });
});

// ポップアップからのメッセージ受信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.command === 'startTimer') {
    // アクティブタブを取得して開始
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        startAlarm(msg.minutes, tabs[0].id);
        // コンテントスクリプトにUFO出現＆浮遊開始を通知
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showUFO' }).catch(() => {});
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    });
    return true; // 非同期応答
  }

  if (msg.command === 'stopTimer') {
    stopAlarm();
    // UFOを消す指示を送る（任意）
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'hideUFO' }).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (msg.command === 'forceSuck') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'suck' }).catch(() => {});
        // 強制吸引時はアラーム停止
        stopAlarm();
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (msg.command === 'getTimerStatus') {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const timerData = data.timerData;
      if (timerData) {
        const remaining = Math.max(0, Math.ceil((timerData.endTime - Date.now()) / 1000));
        sendResponse({ active: true, remaining });
      } else {
        sendResponse({ active: false });
      }
    });
    return true;
  }
});
```

### `content.js`（UFO浮遊＆吸引エンジン）
```javascript
let ufo = null;
let isFlying = false;
let flyingAnimationId = null;
let isSucking = false;

// UFO要素の生成
function createUFO() {
  if (ufo) return;
  ufo = document.createElement('img');
  ufo.src = chrome.runtime.getURL('ufo.png');
  ufo.style.position = 'fixed';
  ufo.style.top = '50%';
  ufo.style.left = '50%';
  ufo.style.transform = 'translate(-50%, -50%)';
  ufo.style.width = '100px';
  ufo.style.height = 'auto';
  ufo.style.zIndex = '99999';
  ufo.style.pointerEvents = 'none'; // クリックを透過
  ufo.id = 'ufo-santi';
  document.body.appendChild(ufo);
}

// UFO削除
function removeUFO() {
  if (ufo) {
    ufo.remove();
    ufo = null;
  }
  stopFlying();
}

// 浮遊開始
function startFlying() {
  if (isFlying) return;
  isFlying = true;
  function fly() {
    if (!ufo || !isFlying) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ufoWidth = 100; // approx
    // 簡単なランダム移動（シンプルな酔歩）
    let currentX = parseFloat(ufo.style.left) || w/2;
    let currentY = parseFloat(ufo.style.top) || h/2;
    const speed = 2;
    const angle = Math.random() * Math.PI * 2;
    let nextX = currentX + Math.cos(angle) * speed;
    let nextY = currentY + Math.sin(angle) * speed;
    // 画面端バウンド
    if (nextX < ufoWidth/2) nextX = ufoWidth/2;
    if (nextX > w - ufoWidth/2) nextX = w - ufoWidth/2;
    if (nextY < ufoWidth/2) nextY = ufoWidth/2;
    if (nextY > h - ufoWidth/2) nextY = h - ufoWidth/2;
    ufo.style.left = nextX + 'px';
    ufo.style.top = nextY + 'px';
    flyingAnimationId = requestAnimationFrame(fly);
  }
  fly();
}

function stopFlying() {
  isFlying = false;
  if (flyingAnimationId) {
    cancelAnimationFrame(flyingAnimationId);
    flyingAnimationId = null;
  }
}

// 吸引シーケンス
function startSucking() {
  if (isSucking) return;
  isSucking = true;
  stopFlying();

  // UFOを中央へ
  if (ufo) {
    ufo.style.transition = 'all 1s';
    ufo.style.left = '50%';
    ufo.style.top = '50%';
    ufo.style.transform = 'translate(-50%, -50%) scale(1.5)';
  }

  // 少し待ってから吸い込み開始
  setTimeout(() => {
    suckElements();
  }, 1000);
}

function suckElements() {
  // 対象要素: body内のすべての可視要素。ただしUFO自身、スクリプト、スタイルなどは除外
  const targets = Array.from(document.querySelectorAll('body *')).filter(el => {
    if (el === ufo) return false;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT' || el.tagName === 'LINK') return false;
    // 可視性（display:noneやvisibility:hiddenは無視、サイズ0も無視）
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return true;
  });

  if (targets.length === 0) {
    finishSuck();
    return;
  }

  // 各要素を吸い込む
  targets.forEach((el, index) => {
    setTimeout(() => {
      if (!ufo) return;
      const ufoRect = ufo.getBoundingClientRect();
      const ufoCenterX = ufoRect.left + ufoRect.width / 2;
      const ufoCenterY = ufoRect.top + ufoRect.height / 2;
      const elRect = el.getBoundingClientRect();
      const elCenterX = elRect.left + elRect.width / 2;
      const elCenterY = elRect.top + elRect.height / 2;
      const dx = ufoCenterX - elCenterX;
      const dy = ufoCenterY - elCenterY;

      // アニメーション適用前に元の位置・サイズをキープ
      el.style.transition = 'all 0.8s ease-in';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
      el.style.opacity = '0';

      // アニメーション終了後に削除
      el.addEventListener('transitionend', function handler() {
        el.removeEventListener('transitionend', handler);
        el.remove();
      });
    }, index * 50); // 50msずつ遅延
  });

  // 全削除終了後の処理（適当な猶予）
  const totalTime = targets.length * 50 + 1000;
  setTimeout(finishSuck, totalTime);
}

function finishSuck() {
  // 休憩オーバーレイ表示
  const overlay = document.createElement('div');
  overlay.id = 'ufo-break-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = '#000';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontSize = '2rem';
  overlay.style.zIndex = '100000';
  overlay.innerHTML = `
    <p>🛸 UFOがすべてを吸い上げました。</p>
    <p>仕切り直しの時間です。</p>
    <button id="ufo-reload-btn" style="font-size:1.5rem; padding:10px 20px; margin-top:20px;">ページを再読み込み</button>
  `;
  document.body.appendChild(overlay);

  // UFOは隠す
  if (ufo) ufo.style.display = 'none';

  document.getElementById('ufo-reload-btn').addEventListener('click', () => {
    location.reload();
  });

  // 10秒後に自動リロード
  setTimeout(() => {
    if (document.getElementById('ufo-break-overlay')) {
      location.reload();
    }
  }, 10000);
}

// バックグラウンドからのメッセージ受信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'showUFO') {
    createUFO();
    startFlying();
  }
  if (msg.action === 'hideUFO') {
    stopFlying();
    removeUFO();
  }
  if (msg.action === 'suck') {
    startSucking();
  }
  // 応答は不要
});
```

### `popup.html`
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>三体UFO吸引機</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="popup-container">
    <h1>🛸 吸引タイマー</h1>
    <div class="control">
      <label for="minutes-select">時間設定:</label>
      <select id="minutes-select">
        <!-- 1〜59分を動的生成 -->
      </select>
    </div>
    <div id="timer-display" class="timer">--:--</div>
    <div class="buttons">
      <button id="start-btn">開始</button>
      <button id="stop-btn">停止</button>
      <button id="suck-now-btn">いますぐ吸い上げる</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

### `popup.js`（ポップアップ操作）
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('minutes-select');
  const timerDisplay = document.getElementById('timer-display');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const suckNowBtn = document.getElementById('suck-now-btn');

  // 選択肢生成
  for (let m = 1; m <= 59; m++) {
    const option = document.createElement('option');
    option.value = m;
    option.textContent = `${m}分`;
    if (m === 25) option.selected = true;
    select.appendChild(option);
  }

  // 状態更新ループ
  let updateInterval = null;

  function updateTimerStatus() {
    chrome.runtime.sendMessage({ command: 'getTimerStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      if (response.active) {
        const totalSeconds = response.remaining;
        const min = Math.floor(totalSeconds / 60);
        const sec = totalSeconds % 60;
        timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      } else {
        timerDisplay.textContent = '--:--';
      }
    });
  }

  function startUpdating() {
    if (updateInterval) clearInterval(updateInterval);
    updateTimerStatus();
    updateInterval = setInterval(updateTimerStatus, 1000);
  }

  function stopUpdating() {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  }

  startUpdating(); // 初期表示

  startBtn.addEventListener('click', () => {
    const minutes = parseInt(select.value, 10);
    chrome.runtime.sendMessage({ command: 'startTimer', minutes }, (resp) => {
      if (resp && resp.success) {
        startUpdating();
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'stopTimer' }, (resp) => {
      if (resp && resp.success) {
        stopUpdating();
        timerDisplay.textContent = '--:--';
      }
    });
  });

  suckNowBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'forceSuck' });
    stopUpdating();
    timerDisplay.textContent = '発動！';
  });
});
```

### `popup.css`（お好みで）
```css
body {
  width: 250px;
  padding: 16px;
  font-family: sans-serif;
  background: #111;
  color: #eee;
}
h1 {
  font-size: 1.2em;
  text-align: center;
}
.control {
  margin: 10px 0;
}
#minutes-select {
  width: 100%;
  padding: 4px;
}
.timer {
  font-size: 2em;
  text-align: center;
  margin: 10px 0;
}
.buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
button {
  padding: 8px;
  font-size: 1em;
  cursor: pointer;
}
#suck-now-btn {
  background: #b33;
  color: white;
}
```

---

## 🚀 導入方法
1. 上記の全ファイルを `santi-ufo-pomodoro` というフォルダに保存。  
2. あなたの用意した **UFO画像** を `ufo.png` という名前で同じフォルダに入れる。  
3. Chrome で `chrome://extensions` を開き、右上の「デベロッパーモード」をON。  
4. 「パッケージ化されていない拡張機能を読み込む」で上記フォルダを選択。  
5. 拡張機能アイコンからタイマーを設定し、スタート！

---

これで「UFOが全部吸い上げる」コア機能はバッチリです。  
猫ちゃんの癒しとはまた違う、**問答無用の宇宙的強制力**を楽しんでくださいね。  
何か修正したい点や追加したい演出があれば、いつでも言ってください！