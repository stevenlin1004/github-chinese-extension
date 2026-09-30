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

// 向 background 發送翻譯請求
function fetchGoogleTranslate(text) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "TRANSLATE", text: text }, (response) => {
        // 檢查是否有 runtime 錯誤（例如 background 剛好在休眠喚醒中）
        if (chrome.runtime.lastError) {
          console.warn("[GitHub 中文] 通訊異常:", chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        if (response && response.success) {
          resolve(response.translation);
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}
// 清理與正規化字串（移除換行與多餘空格）
function normalizeText(str) {
  return str.replace(/\s+/g, ' ').trim();
}

let isRunning = false;
let pendingReRun = false;

async function smartTranslate(targetNode = document.body) {
  if (isRunning) {
    pendingReRun = true;
    return;
  }
  isRunning = true;

  try {
    const dictCache = await getStorageCache();

    // 1. 抓取文字節點 (Text Nodes)
    const walker = document.createTreeWalker(
      targetNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
          // 只排除程式碼本身與樣式腳本，不要把一般 input 容器都排除
          if (['script', 'style', 'code', 'pre'].includes(parentTag)) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = normalizeText(node.nodeValue);
          if (text.length <= 1 || /^[\d\s\-_./\\:#@%]+$/.test(text)) {
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
      const rawText = currentNode.nodeValue;
      const normalized = normalizeText(rawText);

      // 檢查快取
    // 1. 最高優先：靜態字典 DICT（防止 Fork 翻成叉子）
      if (typeof DICT !== "undefined" && DICT[normalized]) {
        currentNode.nodeValue = rawText.replace(normalized, DICT[normalized]);
      } 
      // 2. 次要優先：先前 Google 翻譯過的快取
      else if (dictCache[normalized]) {
        if (!rawText.includes(dictCache[normalized])) {
          currentNode.nodeValue = rawText.replace(normalized, dictCache[normalized]);
        }
      } 
      // 3. 都沒命中：送去 Google 翻譯
      else {
        pendingNodes.push({ node: currentNode, raw: rawText, key: normalized });
        wordsToFetch.add(normalized);
      }

    // 2. 針對 input 的 placeholder 也進行翻譯支援（例如 Go to file）
    const inputs = targetNode.querySelectorAll ? targetNode.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
    inputs.forEach(input => {
      const ph = normalizeText(input.getAttribute('placeholder') || '');
      if (ph && !/^[\d\s\-_./\\:]+$/.test(ph)) {
        if (typeof DICT !== "undefined" && DICT[ph]) {
          input.setAttribute('placeholder', DICT[ph]);
        } else if (dictCache[ph]) {
          input.setAttribute('placeholder', dictCache[ph]);
        } else {
          wordsToFetch.add(ph);
        }
      }
    });

    // 3. 發送翻譯 API 請求
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

        // 回填文字節點
        pendingNodes.forEach(({ node, raw, key }) => {
          if (dictCache[key]) {
            node.nodeValue = raw.replace(key, dictCache[key]);
          }
        });

        // 回填 placeholder
        inputs.forEach(input => {
          const ph = normalizeText(input.getAttribute('placeholder') || '');
          if (dictCache[ph]) {
            input.setAttribute('placeholder', dictCache[ph]);
          }
        });

        await saveStorageCache(dictCache);
      }
    }
  } finally {
    isRunning = false;
    // 如果在執行過程中又有新的節點進來，補跑一次
    if (pendingReRun) {
      pendingReRun = false;
      scheduleTranslate();
    }
  }
}

// 防抖排程器
let debounceTimer = null;
function scheduleTranslate(node = document.body) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    smartTranslate(node);
  }, 120);
}

// 監聽載入與換頁
document.addEventListener("DOMContentLoaded", () => scheduleTranslate());
scheduleTranslate();
document.addEventListener("turbo:load", () => scheduleTranslate());
document.addEventListener("turbo:render", () => scheduleTranslate());
document.addEventListener("pjax:end", () => scheduleTranslate());

// 監聽 DOM 樹變更
const observer = new MutationObserver((mutations) => {
  let hasNew = false;
  for (const m of mutations) {
    if (m.addedNodes.length > 0) {
      hasNew = true;
      break;
    }
  }
  if (hasNew) scheduleTranslate();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});