chrome.runtime.onInstalled.addListener(() => {
  console.log("[GitHub 中文] Background Service Worker 就緒");
});

// 建立全域排隊 Promise 鏈
let queue = Promise.resolve();

// 延遲工具函式
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TRANSLATE") {
    // 將每個請求串接在隊列最後，保證依序發送，絕不並行連擊
    queue = queue.then(async () => {
      try {
        const text = request.text;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;

        // 每次發送固定冷卻 350 毫秒，維持安全頻率
        await sleep(350);

        let res = await fetch(url);

        // 如果不幸遇到 429，冷卻 1.5 秒後重試一次
        if (res.status === 429) {
          console.warn("[GitHub 中文] 觸發 429 限流，冷卻 1.5 秒後重試...");
          await sleep(1500);
          res = await fetch(url);
        }

        if (!res.ok) {
          console.warn(`[GitHub 中文] API 狀態異常: ${res.status}`);
          sendResponse({ success: false, status: res.status });
          return;
        }

        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const result = data[0].map((item) => item[0]).join("");
          sendResponse({ success: true, translation: result });
        } else {
          sendResponse({ success: false });
        }
      } catch (err) {
        console.warn("[GitHub 中文] 網路或解析失敗:", err.message);
        sendResponse({ success: false, error: err.message });
      }
    });

    return true; // 保持非同步通道開啟
  }
});