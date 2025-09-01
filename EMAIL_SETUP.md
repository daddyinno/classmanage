# 📧 郵件備份設置指南

## 概述

系統支援每日自動將 SQLite 數據庫文件作為附件發送到指定郵箱，提供額外的備份保護。

## 🛠️ 設置步驟

### 1. 配置 Gmail SMTP（推薦）

#### 啟用 Gmail App Password
1. 登入 Google 帳戶
2. 前往 **Google 帳戶設置** → **安全性**
3. 啟用 **兩步驟驗證**（如果未啟用）
4. 在 **兩步驟驗證** 下方，點擊 **應用程式密碼**
5. 選擇 **郵件** 和 **其他（自訂名稱）**
6. 輸入 "班級管理系統備份"
7. 複製生成的 16 位密碼

#### 配置環境變量
在 `.env` 文件中設置：

```bash
# Gmail SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-digit-app-password

# 郵件設置
BACKUP_FROM_EMAIL=your-gmail@gmail.com
BACKUP_TO_EMAIL=backup-receiver@gmail.com
```

### 2. 配置其他郵件服務

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

#### Yahoo Mail
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

#### 自訂 SMTP 服務器
```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
```

### 3. 進階郵件設置

```bash
# 多個收件人（可選）
BACKUP_TO_EMAIL=primary@example.com,secondary@example.com

# 抄送和密送（可選）
BACKUP_CC_EMAIL=manager@example.com
BACKUP_BCC_EMAIL=it-team@example.com

# 自訂發件人顯示名稱（可選）
BACKUP_FROM_EMAIL="班級管理系統 <system@yourschool.edu>"
```

## 🧪 測試配置

### 1. 檢查郵件配置
```bash
npm run email:config
```

### 2. 測試 SMTP 連接
```bash
npm run email:test
```

### 3. 測試發送備份文件
```bash
# 先創建備份
npm run backup:local

# 發送最新備份
npm run email:send backups/classroom_backup_2024-01-01_12-00-00.db
```

## 📋 使用方式

### 立即發送備份郵件
```bash
# 創建備份並發送郵件（不上傳雲端）
npm run backup:email

# 完整備份（本地 + 雲端 + 郵件）
npm run backup
```

### 自動定時備份
設置每日自動備份（包含郵件發送）：
```bash
npm run setup:cron
```

或手動添加 crontab：
```bash
crontab -e
# 添加: 0 2 * * * cd /path/to/your/app && npm run backup
```

### 發送現有備份文件
```bash
npm run email:send backups/your-backup-file.db
```

## 📧 郵件內容

自動發送的郵件包含：

- **美觀的 HTML 格式**
- **備份詳情**：文件名、大小、備份時間
- **系統統計**：學生數量、記錄總數、運行天數
- **完整性狀態**：數據庫完整性檢查結果
- **安全提醒**：備份保存和使用建議

## ⚠️ 注意事項

### 安全建議
1. **不要在代碼中硬編碼密碼**
2. **使用 App Password 而非帳戶密碼**
3. **定期更換郵件密碼**
4. **限制 .env 文件權限**：
   ```bash
   chmod 600 .env
   ```

### 文件大小限制
- **Gmail**: 25MB 附件限制
- **Outlook**: 20MB 附件限制
- **Yahoo**: 25MB 附件限制

一般 SQLite 數據庫文件都很小（通常 < 1MB），不會觸及限制。

### 防垃圾郵件
1. **設置白名單**：在收件郵箱中將發送者加入白名單
2. **檢查垃圾郵件夾**：首次可能被誤判為垃圾郵件
3. **使用企業郵箱**：更高的送達率

## 🔧 故障排除

### 常見錯誤

**SMTP 認證失敗**
```
❌ Invalid login: 535-5.7.8 Username and Password not accepted
```
**解決方案**：
- 確認 Gmail 已啟用兩步驟驗證
- 使用 App Password 而非帳戶密碼
- 檢查用戶名格式（完整郵件地址）

**連接超時**
```
❌ Connection timeout
```
**解決方案**：
- 檢查網路連接
- 確認 SMTP 主機和端口正確
- 檢查防火牆設置

**附件過大**
```
❌ 備份文件過大，超過郵件附件限制
```
**解決方案**：
- 檢查數據庫文件大小
- 考慮數據庫清理或歸檔
- 使用雲端備份作為替代

### 檢查命令

```bash
# 檢查配置
npm run email:config

# 查看詳細錯誤
NODE_ENV=development npm run email:test

# 檢查日誌
tail -f logs/backup.log
```

## 📊 郵件統計和監控

系統會記錄：
- 郵件發送成功/失敗次數
- 發送時間和收件人
- 錯誤詳情和解決方案

查看日誌：
```bash
# 備份日誌
tail -f logs/backup.log

# 應用日誌
tail -f logs/app.log
```

## 🔄 最佳實踐

1. **定期測試**：每月測試一次郵件備份
2. **多重備份**：結合本地、雲端和郵件備份
3. **監控郵件**：確保每日備份郵件正常收到
4. **文檔備份**：保存郵件配置文檔
5. **災難恢復**：定期測試從郵件附件恢復數據

## 📞 支援

如遇問題：
1. 檢查環境變量配置
2. 運行診斷命令
3. 查看錯誤日誌
4. 參考故障排除指南

郵件備份為您的重要數據增加了額外保護層，建議與其他備份方式結合使用。

