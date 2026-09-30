# GitHub 智慧快取中文翻譯 (Chrome Extension PoC)

> 一個基於 Manifest V3 架構的 GitHub 介面在地化與繁體中文術語校正擴充套件（技術驗證原型）。

---

## 📌 專案背景與初衷

GitHub 原生介面為全英文，雖然瀏覽器自帶全頁翻譯，但經常會出現軟體專業術語翻譯不精確的問題（例如將 `Fork` 翻為「叉子」、`Branch` 翻為「分公司」、`Pull Request` 翻為「拉取請求」）。

本專案旨在打造一個輕量化的 Chrome 擴充功能，透過**「靜態專業術語庫」+「動態本機快取」+「第三方翻譯兜底」**的三層架構，嘗試兼顧專業名詞準確度與全站介面翻譯覆蓋率。

---

## 🛠 技術架構與亮點

1. **Manifest V3 架構實作**
   - 透過 `content_scripts` 進行 DOM 樹操作。
   - 透過 `background service worker` 繞過 GitHub 嚴格的 CSP (Content Security Policy) 限制發送外部翻譯請求。
   - 使用 `chrome.storage.local` 實作翻譯快取資料庫，避免對相同字串重複發送網路請求。

2. **高效能 DOM 遍歷與監聽**
   - 使用 `TreeWalker` (NodeFilter.SHOW_TEXT) 精準過濾文字節點，避開 `<script>`、`<style>`、`<code>`、`<pre>` 等程式碼區塊。
   - 搭配 `MutationObserver` 監聽 GitHub 單頁導航（Turbo / PJAX）與動態渲染。
   - 實作 **防抖機制 (Debounce, 250ms)**，避免動態生成元件時引發畫面卡頓與請求風暴。

3. **高並發限流與退避演算法**
   - 針對免費翻譯介面的 `HTTP 429 Too Many Requests` 限流機制，在背景端實作基於 Promise 鏈的非同步佇列 (Request Queue)。
   - 實作安全請求延遲與 **指數退避重試 (Exponential Backoff: 1.5s -> 3s -> 6s)**。

---

## 💡 專案結案反思與評估 (Project Conclusion)

經過完整的概念驗證 (PoC) 與實作測試，本專案決定在此停止進一步開發，主要評估如下：

1. **功能邊際效益考量**：
   - 現代瀏覽器內建的原生翻譯已具備極高的流暢度與段落語意理解能力，且無外部 API 速率限制問題。
   - 若要由擴充功能承擔全網頁的通用長句翻譯，容易落入與原生工具重複造輪子的困境，且維護外部請求限流的邊際成本過高。

2. **架構驗證目標已達成**：
   - 本專案已完整實踐 Chrome Extension Manifest V3 核心通訊機制、本機 LevelDB 快取、非同步佇列調度與 DOM 樹安全遍歷等前端關鍵技術。
   - 程式碼保留於此作為前端系統設計與架構驗證之原型參考。