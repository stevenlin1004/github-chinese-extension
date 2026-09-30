chrome.runtime.onInstalled.addListener(() => {
  console.log("[GitHub 中文] Background Service Worker 就緒");
});

// 全域排隊隊列
let queue = Promise.resolve();

// 延遲工具函式
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 帶有指數退避重試的 Fetch
async function fetchWithRetry(url, maxRetries = 3) {
  let delay = 1500; // 首次遇到 429 退避 1.5 秒

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 每次請求間隔安全延遲 300ms
    await sleep(300);

    try {
      const res = await fetch(url);

      if (res.status === 429) {
        if (attempt < maxRetries) {
          console.warn(`[GitHub 中文] 遇到 429，等待 ${delay / 1000} 秒進行第 ${attempt + 1} 次重試...`);
          await sleep(delay);
          delay *= 2; // 指數退避：1.5s -> 3s -> 6s
          continue;
        } else {
          throw new Error("429_MAX_RETRIES_EXCEEDED");
        }
      }

      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(1000);
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TRANSLATE") {
    queue = queue.then(async () => {
      try {
        const text = request.text;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;

        const data = await fetchWithRetry(url);

        if (Array.isArray(data) && Array.isArray(data[0])) {
          const result = data[0].map((item) => item[0]).join("");
          sendResponse({ success: true, translation: result });
        } else {
          sendResponse({ success: false });
        }
      } catch (err) {
        console.warn("[GitHub 中文] 翻譯請求失敗:", err.message);
        sendResponse({ success: false, error: err.message });
      }
    });

    return true; // 保持非同步通道開啟
  }
});