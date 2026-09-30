// 安裝或重載時主動喚醒
chrome.runtime.onInstalled.addListener(() => {
  console.log("[GitHub 中文] Background Service Worker 已就緒");
});

// 監聽來自 content.js 的翻譯請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TRANSLATE") {
    const text = request.text;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const result = data[0].map((item) => item[0]).join('');
          sendResponse({ success: true, translation: result });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch((err) => {
        console.error("背景翻譯失敗:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // 保持非同步訊息通道開啟（必備）
  }
});