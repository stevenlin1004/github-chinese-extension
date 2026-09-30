// 封裝 chrome.storage 的讀取
function getStorageCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["dictCache"], (result) => {
      resolve(result.dictCache || {});
    });
  });
}

// 封裝 chrome.storage 的寫入
function saveStorageCache(cache) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ dictCache: cache }, () => {
      resolve();
    });
  });
}

// 單一字串或批次呼叫 Google 翻譯
async function fetchGoogleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(item => item[0]).join('');
  } catch (err) {
    console.error("翻譯請求失敗:", err);
    return null;
  }
}

let isTranslating = false;

// 核心翻譯函式
async function smartTranslate(targetNode = document.body) {
  if (isTranslating) return;
  isTranslating = true;

  try {
    const dictCache = await getStorageCache();

    const walker = document.createTreeWalker(
      targetNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
          // 排除程式碼、腳本、輸入欄位
          if (['script', 'style', 'textarea', 'input', 'code', 'pre'].includes(parentTag)) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.nodeValue.trim();
          // 排除數字、符號、過短字串
          if (text.length <= 1 || /^[\d\s\-_./\\:]+$/.test(text)) {
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const pendingNodes = [];
    const wordsToFetch = new Set();

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const originalText = currentNode.nodeValue;
      const trimmed = originalText.trim();

      // 1. 命中快取，立刻替換
      if (dictCache[trimmed]) {
        currentNode.nodeValue = originalText.replace(trimmed, dictCache[trimmed]);
      } else {
        // 2. 沒命中，準備打 API
        pendingNodes.push({ node: currentNode, raw: originalText, trimmed: trimmed });
        wordsToFetch.add(trimmed);
      }
    }

    // 若有新單字需要請求 API
    if (wordsToFetch.size > 0) {
      const newWordsArray = Array.from(wordsToFetch);
      const delimiter = "\n---\n";
      const combinedText = newWordsArray.join(delimiter);

      const translatedResponse = await fetchGoogleTranslate(combinedText);
      if (translatedResponse) {
        const translatedArray = translatedResponse.split(delimiter);

        newWordsArray.forEach((word, index) => {
          if (translatedArray[index]) {
            dictCache[word] = translatedArray[index].trim();
          }
        });

        // 回填文字
        pendingNodes.forEach(({ node, raw, trimmed }) => {
          if (dictCache[trimmed]) {
            node.nodeValue = raw.replace(trimmed, dictCache[trimmed]);
          }
        });

        await saveStorageCache(dictCache);
      }
    }
  } finally {
    isTranslating = false;
  }
}

// 防抖函式（避免動態監聽時頻繁觸發）
let debounceTimer = null;
function scheduleTranslate(node = document.body) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    smartTranslate(node);
  }, 100); // 100 毫秒內多次變動只執行一次
}

// 1. 初次載入
document.addEventListener("DOMContentLoaded", () => scheduleTranslate());
scheduleTranslate();

// 2. 監聽 GitHub 的單頁切換 (Turbo / PJAX 事件)
document.addEventListener("turbo:load", () => scheduleTranslate());
document.addEventListener("turbo:render", () => scheduleTranslate());
document.addEventListener("pjax:end", () => scheduleTranslate());

// 3. 監聽點擊與動態彈出選單（解決三橫線選單、下拉選單問題）
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      scheduleTranslate();
      break;
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});