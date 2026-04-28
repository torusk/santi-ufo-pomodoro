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