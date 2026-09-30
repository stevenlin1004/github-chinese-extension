// dict.js - 軟體工程 / GitHub 專用語意字典
const staticDict = {
  // 核心操作與架構
  "Repositories": "儲存庫",
  "Repository": "儲存庫",
  "Fork": "派生分支",
  "Forks": "派生分支",
  "Star": "加星收藏",
  "Stars": "加星收藏",
  "Branch": "分支",
  "Branches": "分支",
  "Commit": "提交紀錄",
  "Commits": "提交紀錄",
  "Pull requests": "合併請求",
  "Pull request": "合併請求",
  "Issues": "議題",
  "Issue": "議題",
  "Actions": "自動化工作流",
  "Projects": "專案看板",
  "Wiki": "共筆文件",
  "Security": "資安檢測",
  "Insights": "統計分析",
  "Settings": "設定",

  // 頁面常見按鈕與標籤
  "Releases": "版本發佈",
  "Release": "版本發佈",
  "Packages": "套件發佈",
  "Contributors": "專案貢獻者",
  "Code": "程式碼",
  "Go to file": "快速尋找檔案",
  "Add file": "新增檔案",
  "Create new file": "建立新檔案",
  "Upload files": "上傳檔案",
  "Clone": "複製儲存庫",
  "Download ZIP": "下載 ZIP 壓縮檔",
  "README": "專案說明文件",
  "License": "開源授權條款",
  "Latest": "最新版",
  "Compare": "版本對比"
};

// 匯出讓 content.js 讀取
if (typeof window !== "undefined") {
  window.staticDict = staticDict;
}