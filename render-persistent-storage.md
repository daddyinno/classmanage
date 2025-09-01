# Render 持久化存儲配置指南

## 🎯 問題說明
Render 每次部署都會重新構建容器，導致：
- SQLite 數據庫文件丟失
- 用戶數據、學生記錄、分數等全部重置
- 備份文件也會消失

## 💾 解決方案

### 方案 1：Render 持久化磁碟（最佳方案）

#### 1. 創建持久化磁碟
```bash
# 通過 Render Dashboard 或 MCP 創建
# 大小：建議 1GB（免費方案限制）
# 掛載路徑：/opt/render/project/data
```

#### 2. 更新環境變數
```env
DB_PATH=/opt/render/project/data/classroom.db
BACKUP_DIR=/opt/render/project/data/backups
```

#### 3. 更新代碼以支援持久化路徑
- 數據庫文件：/opt/render/project/data/classroom.db  
- 備份目錄：/opt/render/project/data/backups
- 上傳文件：/opt/render/project/data/uploads

### 方案 2：外部資料庫服務

#### PostgreSQL (Render 提供)
```bash
# 優點：
- 完全託管
- 自動備份
- 高可用性
- 免費方案提供 1GB

# 缺點：
- 需要遷移 SQLite 數據
- 修改代碼以支援 PostgreSQL
```

#### Supabase/PlanetScale
```bash
# 免費的雲端數據庫服務
# 提供 PostgreSQL/MySQL
```

### 方案 3：雲端存儲（進階）

#### 使用 Render MCP 整合
```javascript
// 定期同步到雲端存儲
// S3, Google Cloud Storage 等
```

## 🚀 實施步驟（方案 1）

### 步驟 1：使用 Render MCP 創建持久化存儲
```javascript
// 注意：需要付費方案才能使用持久化磁碟
mcp_render_create_postgres({
  name: "classmanage-db",
  plan: "free", // 免費 PostgreSQL
  region: "singapore"
})
```

### 步驟 2：修改數據庫連接（如果使用 PostgreSQL）
```javascript
// 安裝 pg 驅動
npm install pg

// 修改 database.js 以支援 PostgreSQL
```

### 步驟 3：數據遷移
```bash
# 從 SQLite 遷移到 PostgreSQL
# 或者使用持久化磁碟保持 SQLite
```

## ⚠️ 重要提醒

1. **免費方案限制**：
   - Render 免費方案不支援持久化磁碟
   - 建議使用免費的 PostgreSQL 服務

2. **數據備份**：
   - 無論使用哪種方案，都要保持郵件備份
   - 定期下載數據庫備份

3. **測試重要性**：
   - 在生產環境前先測試數據持久性
   - 驗證部署後數據是否保留

## 💡 立即可行的解決方案

由於 Render 免費方案的限制，建議：

1. **短期**：加強郵件備份頻率（每小時一次）
2. **長期**：遷移到 PostgreSQL 或考慮付費方案
3. **備用**：使用 GitHub 或其他服務存儲數據庫文件
