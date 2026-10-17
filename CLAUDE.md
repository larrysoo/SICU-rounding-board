# SICU Rounding Board — 給 AI agent 的開工說明

## 先讀這些
1. `git log --oneline -10` 與 `gh issue list`：現在進度與待辦
2. Wiki（clone 在 `../SICU-rounding-board.wiki/`），依任務挑著讀：
   - `Architecture.md`：單檔 IIFE、三層儲存、程式地圖
   - `Data-Model.md`：資料結構、snapshot / carry-forward 模式、`mg()` migration
   - `Sync-and-Merge.md`：同步、衝突合併、**刪除安全三鎖**（動 flush/sync 前必讀）
   - `Clinical-Rules.md`：臨床公式與門檻（**fluid balance 四處一致**）
   - `Dev-Guide.md`：合作方式與踩過的坑
3. `CLAUDE.local.md`（若存在，不進版控）：本機的內部文件位置

## 專案結構
- `index.html`：整個 app（HTML + CSS + JS 單檔，約 480 KB）。用 grep 找位置，不要整檔讀。
- `sw.js`：service worker，`CACHE` 版號必須與 index.html 的 `vX.Y.Z ·` 一致
- `pouchdb.min.js`：第三方函式庫，不要改
- `scripts/check.mjs`：CI 檢查（語法、版號一致、個資格式）

## 工作規則
- 一個需求 = 一個 issue = 一條 branch（`feat/<issue#>-短名`、`fix/<issue#>-短名`）
- 不直接 commit 到 main；一律開 PR，PR 內寫 `Closes #<issue#>`
- 改版時同步 bump：index.html 顯示版號 + sw.js `CACHE`
- commit 前跑 `node scripts/check.mjs` 與 `for f in test/*.test.mjs; do node $f; done`
- 新邏輯優先寫成可獨立測試的純函式，用 `test/harness.mjs` 的 `load([...])` 抽出測試
- 動到資料結構：在 `mg()` 補 migration，舊資料必須能載入；localStorage key `larrys_sicu_rounds_v13_2b` 不可改
- 學到的架構/規則寫進 wiki，不要在 repo 裡新增 handoff 類 .md

## 紅線
- repo、issue、wiki 都是公開的：只能用合成的 demo 資料，不得出現病人姓名、病歷號、身分證字號
