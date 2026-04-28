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
  console.log(`⏰ アラーム設定: ${delayInMinutes}分後, タブID: ${tabId}`);
}

// アラーム停止
function stopAlarm() {
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      chrome.storage.local.remove(STORAGE_KEY);
      console.log('🛑 アラームを停止しました');
    }
  });
}

// アラーム発火 → タブへ吸引指令
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log('🚨 アラームが発火しました！');

  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const timerData = data.timerData;
    if (!timerData) return;

    chrome.tabs.get(timerData.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.error('❌ 対象のタブが見つかりません');
        chrome.storage.local.remove(STORAGE_KEY);
        return;
      }
      console.log('🌪️ タブへ吸引命令を送信:', tab.id);
      chrome.tabs.sendMessage(tab.id, { action: 'suck' }).catch((err) => {
        console.error('❌ メッセージ送信失敗:', err.message);
      });
    });

    chrome.storage.local.remove(STORAGE_KEY);
  });
});

// ポップアップからのメッセージ受信
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('📬 ポップアップから受信:', msg.command);

  if (msg.command === 'startTimer') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const targetTab = tabs[0];
        console.log('🎯 ターゲットタブ:', targetTab.id, targetTab.url);
        startAlarm(msg.minutes, targetTab.id);
        
        chrome.tabs.sendMessage(targetTab.id, { action: 'showUFO' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ showUFO 送信エラー:', chrome.runtime.lastError.message);
          } else {
            console.log('✅ showUFO 送信完了');
          }
        });
        sendResponse({ success: true });
      } else {
        console.error('❌ アクティブなタブが見つかりません');
        sendResponse({ success: false });
      }
    });
    return true; 
  }

  if (msg.command === 'stopTimer') {
    stopAlarm();
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'hideUFO' }).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (msg.command === 'forceSuck') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        console.log('🚀 強制吸引発動:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showUFO' });
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'suck' });
        }, 500);
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