// content.js - 智慧階層翻譯核心

function getStorageCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["dictCache"], (result) => {
      resolve(result.dictCache || {});
    });
  });
}

function saveStorageCache(cache) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ dictCache: cache }, () => {
      resolve();
    });
  });
}

function fetchGoogleTranslate(text) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "TRANSLATE", text: text }, (response) => {
        if (chrome.runtime.lastError) {
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

    const walker = document.createTreeWalker(
      targetNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
          if (['script', 'style', 'code', 'pre', 'kbd'].includes(parentTag)) {
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

      // 1. 本地靜態字典完全比對 (優先度最高)
      if (typeof DICT !== "undefined" && DICT[normalized]) {
        if (!rawText.includes(DICT[normalized])) {
          currentNode.nodeValue = rawText.replace(normalized, DICT[normalized]);
        }
        continue;
      }

      // 2. 針對純短詞（如 "1 branch", "0 forks"）進行局部術語替換
      const wordCount = normalized.split(' ').length;
      if (wordCount <= 3 && typeof DICT !== "undefined") {
        let partialReplaced = normalized;
        for (const [key, val] of Object.entries(DICT)) {
          const regex = new RegExp(`\\b${key}\\b`, "i");
          if (regex.test(partialReplaced)) {
            partialReplaced = partialReplaced.replace(regex, val);
          }
        }
        if (partialReplaced !== normalized) {
          currentNode.nodeValue = rawText.replace(normalized, partialReplaced);
          continue; // 成功替換短詞術語，結束此節點
        }
      }

      // 3. 快取比對 (如果整句已經翻譯過)
      if (dictCache[normalized]) {
        if (!rawText.includes(dictCache[normalized])) {
          currentNode.nodeValue = rawText.replace(normalized, dictCache[normalized]);
        }
        continue;
      }

      // 4. 若都不是，則為「新單字」或「完整長句」，整句排入 Google 翻譯
      pendingNodes.push({ node: currentNode, raw: rawText, key: normalized });
      wordsToFetch.add(normalized);
    }

    // 支援 input 與 textarea placeholder
    const inputs = targetNode.querySelectorAll ? targetNode.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
    inputs.forEach((input) => {
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

    // 分批發送 Google 翻譯（每批最多 20 句，避免超過 URL 長度或觸發 429）
    if (wordsToFetch.size > 0) {
      const allWords = Array.from(wordsToFetch);
      const BATCH_SIZE = 20;

      for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
        const batch = allWords.slice(i, i + BATCH_SIZE);
        const delimiter = "\n---\n";
        const combinedText = batch.join(delimiter);

        const translatedResponse = await fetchGoogleTranslate(combinedText);
        if (translatedResponse) {
          const translatedArray = translatedResponse.split(delimiter);

          batch.forEach((word, index) => {
            if (translatedArray[index]) {
              dictCache[word] = translatedArray[index].trim();
            }
          });

          // 即時回填文字節點
          pendingNodes.forEach(({ node, raw, key }) => {
            if (dictCache[key]) {
              node.nodeValue = raw.replace(key, dictCache[key]);
            }
          });

          // 即時回填 placeholder
          inputs.forEach((input) => {
            const ph = normalizeText(input.getAttribute('placeholder') || '');
            if (dictCache[ph]) {
              input.setAttribute('placeholder', dictCache[ph]);
            }
          });

          await saveStorageCache(dictCache);
        }
      }
    }
  } finally {
    isRunning = false;
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
  }, 250);
}

document.addEventListener("DOMContentLoaded", () => scheduleTranslate());
scheduleTranslate();
document.addEventListener("turbo:load", () => scheduleTranslate());
document.addEventListener("turbo:render", () => scheduleTranslate());
document.addEventListener("pjax:end", () => scheduleTranslate());

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