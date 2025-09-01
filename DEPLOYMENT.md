# 部署和備份指南

## 🚀 快速開始

```bash
# 1. 克隆項目
git clone <repository-url>
cd classmanage

# 2. 自動設置
node setup.js

# 3. 啟動系統
npm start
```

## 📋 部署選項

### 推薦平台

#### 1. **Railway** (最推薦)
Railway 是最適合此系統的 hosting 平台：

```bash
# 安裝 Railway CLI
npm install -g @railway/cli

# 登入並部署
railway login
railway init
railway up
```

**配置要點：**
- ✅ 自動檢測 Node.js 項目
- ✅ 內建 SSL 和域名
- ✅ 支持持久化存儲（適合 SQLite）
- ✅ 免費額度充足
- 💰 成本效益高

**環境變量設置：**
```bash
railway variables set NODE_ENV=production
railway variables set AUTO_BACKUP_ENABLED=true
railway variables set DB_PATH=/app/data/classroom.db
```

#### 2. **Render**
適合免費部署和測試：

1. 連接 GitHub repository
2. 設置構建命令: `npm install`
3. 設置啟動命令: `npm start`
4. 添加環境變量（見下方配置）

#### 3. **Fly.io**
適合需要全球分佈的應用：

```bash
# 安裝 Fly CLI
curl -L https://fly.io/install.sh | sh

# 部署
fly launch
fly deploy
```

#### 4. **Docker 部署**
支持任何 Docker 平台：

```bash
# 本地測試
docker-compose up -d

# 生產部署
docker-compose -f docker-compose.yml up -d
```

## 🔧 環境配置

### 基本設置
複製 `env.example` 為 `.env` 並配置：

```bash
# 服務器配置
PORT=3000
BASE_PATH=                    # 子文件夾部署時設置，如: /classmanage

# 環境設置
NODE_ENV=production

# 數據庫配置
DB_PATH=./data/classroom.db   # 建議使用絕對路徑

# 安全配置
TEACHER_PASSWORD=28915063     # 建議修改預設密碼

# 自動備份設置
AUTO_BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
MAX_LOCAL_BACKUPS=7

# 雲端備份配置 (可選)
BACKUP_WEBHOOK_URL=           # Dropbox/Google Drive webhook URL
BACKUP_API_KEY=               # API 認證密鑰

# 郵件備份配置 (可選但推薦)
SMTP_HOST=smtp.gmail.com      # SMTP 服務器
SMTP_PORT=587                 # SMTP 端口
SMTP_USER=your-email@gmail.com # SMTP 用戶名
SMTP_PASS=your-app-password   # SMTP 密碼/App Password
BACKUP_TO_EMAIL=backup@gmail.com # 備份接收郵箱
```

### 子文件夾部署

如果需要部署到子文件夾（例如 `https://yourdomain.com/classmanage/`）：

```bash
# 設置環境變數
BASE_PATH=/classmanage PORT=3000 node server.js

# 或在 .env 檔案中設置
echo "BASE_PATH=/classmanage" >> .env
```

**Web服务器配置：**

Apache (.htaccess):
```apache
RewriteEngine On
RewriteRule ^classmanage/api/(.*)$ classmanage/server.js/$1 [L,P]
```

Nginx:
```nginx
location /classmanage/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 💾 數據庫備份策略

### 自動備份系統

系統內建多層備份保護：

1. **本地備份** - 每天自動備份到 `backups/` 目錄
2. **雲端備份** - 可選上傳到雲端存儲
3. **📧 郵件備份** - 每日自動發送數據庫文件到指定郵箱
4. **完整性檢查** - 備份前驗證數據庫完整性
5. **版本管理** - 保留最近 7 天的備份

### 備份操作

```bash
# 完整備份（本地 + 雲端 + 郵件）
npm run backup

# 僅本地備份
npm run backup:local

# 本地備份 + 郵件發送
npm run backup:email

# 查看所有備份
npm run backup:list

# 檢查數據庫完整性
npm run backup:check

# 恢復數據庫
npm run backup:restore backups/classroom_backup_2024-01-01_12-00-00.db

# 郵件相關操作
npm run email:test          # 測試郵件配置
npm run email:config        # 檢查郵件設置
npm run email:send <file>   # 發送指定備份文件
```

### 設置定時備份

#### Linux/macOS (crontab):
```bash
# 設置每天凌晨 2 點自動備份
npm run setup:cron

# 或手動添加 crontab
crontab -e
# 添加: 0 2 * * * cd /path/to/your/app && npm run backup:cron
```

#### Windows (Task Scheduler):
1. 打開 Task Scheduler
2. 創建基本任務
3. 設置觸發器為每日 2:00 AM
4. 操作：啟動程序 `node`
5. 參數：`cron-backup.js`
6. 起始目錄：項目路徑

### 雲端備份配置

#### Dropbox 集成
1. 創建 Dropbox App
2. 獲取 API token
3. 設置 webhook URL

```bash
# 環境變量設置
BACKUP_WEBHOOK_URL=https://content.dropboxapi.com/2/files/upload
BACKUP_API_KEY=your-dropbox-token
```

#### Google Drive 集成
1. 創建 Google Cloud 項目
2. 啟用 Drive API
3. 獲取服務帳戶憑證

#### 自定義 webhook
您可以設置任何支持檔案上傳的 webhook 服務。

### 📧 郵件備份配置

郵件備份是最簡單可靠的備份方式，推薦所有用戶啟用：

#### Gmail 設置（推薦）
1. **啟用兩步驟驗證**
2. **創建 App Password**：
   - 前往 Google 帳戶 → 安全性 → 應用程式密碼
   - 選擇"郵件"和"其他"，命名為"班級管理備份"
   - 複製生成的 16 位密碼

3. **配置環境變量**：
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password
BACKUP_TO_EMAIL=backup-receiver@gmail.com
```

#### 其他郵件服務
```bash
# Outlook
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587

# Yahoo
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587

# 企業郵箱
SMTP_HOST=mail.yourcompany.com
SMTP_PORT=587
```

#### 郵件備份特點
- ✅ **自動發送**：每日定時備份
- ✅ **美觀格式**：HTML 郵件包含系統統計
- ✅ **安全可靠**：附件包含完整數據庫
- ✅ **多收件人**：支持抄送和密送
- ✅ **大小限制**：自動檢查附件大小（25MB）

#### 測試郵件配置
```bash
# 檢查配置
npm run email:config

# 測試連接
npm run email:test

# 發送測試備份
npm run backup:email
```

詳細設置請參考：[EMAIL_SETUP.md](./EMAIL_SETUP.md)

## 🔒 安全建議

### 生產環境配置

1. **修改預設密碼**
```bash
# 在 .env 中設置強密碼
TEACHER_PASSWORD=your-strong-password-here
```

2. **限制檔案權限**
```bash
chmod 600 .env
chmod 600 classroom.db
chmod 700 backups/
```

3. **設置防火牆規則**
```bash
# 僅允許 HTTP/HTTPS 流量
ufw allow 80
ufw allow 443
ufw deny 3000  # 如果使用 reverse proxy
```

4. **啟用 HTTPS**
- Railway/Render：自動提供 SSL
- 自定義部署：使用 Let's Encrypt

### 備份安全

1. **加密備份檔案** (可選)
```bash
# 使用 gpg 加密備份
gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    classroom_backup.db
```

2. **多地備份**
- 本地備份：保存在伺服器
- 雲端備份：Dropbox/Google Drive
- 離線備份：定期下載到本地電腦

## 📊 監控和維護

### 系統監控

```bash
# 檢查系統狀態
curl http://localhost:3000/api/students

# 查看日誌
tail -f logs/app.log

# 監控備份狀態
tail -f logs/backup.log
```

### 維護任務

**每週檢查：**
- 確認備份正常執行
- 檢查磁碟空間
- 更新依賴套件

**每月檢查：**
- 測試備份恢復
- 檢查系統性能
- 更新密碼

## 🆘 故障排除

### 常見問題

**數據庫鎖定錯誤：**
```bash
# 檢查是否有多個進程存取
ps aux | grep node

# 重啟應用
pm2 restart app  # 如果使用 PM2
# 或
systemctl restart classmanage  # 如果使用 systemd
```

**備份失敗：**
```bash
# 檢查權限
ls -la backups/

# 檢查磁碟空間
df -h

# 手動執行備份測試
node backup.js check
```

**部署後無法訪問：**
1. 檢查端口配置
2. 確認防火牆設置
3. 檢查 reverse proxy 配置
4. 查看應用日誌

### 聯繫支持

如果遇到問題：
1. 查看日誌檔案 `logs/app.log`
2. 執行 `npm run backup:check` 檢查系統狀態
3. 記錄錯誤信息和操作步驟
