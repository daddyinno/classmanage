#!/usr/bin/env node

/**
 * 使用 Render MCP 創建備份 Cron Job 的腳本
 * 注意：需要先設置 Render API Token 和選擇 workspace
 */

// 這個腳本展示如何使用 MCP 創建 Cron Job
// 實際執行需要在 Cursor 中使用 MCP 工具

const CRON_JOB_CONFIG = {
    name: "classmanage-backup-cron",
    // Render 暫時可能不直接支援 Cron Job，我們使用 Web Service + 內置 cron
    runtime: "node",
    buildCommand: "npm install",
    startCommand: "node backup-service.js", // 使用備份服務，內置了 cron 調度
    plan: "starter", // 免費方案
    region: "singapore", // 選擇新加坡，亞洲時區
    
    envVars: [
        { key: "MAIL_HOST", value: "smtp.gmail.com" },
        { key: "MAIL_PORT", value: "587" },
        { key: "MAIL_USERNAME", value: "daddyinnovation@gmail.com" },
        { key: "MAIL_PASSWORD", value: "hwuhevcsupbhdhie" },
        { key: "MAIL_FROM_ADDRESS", value: "daddyinnovation@gmail.com" },
        { key: "BACKUP_TO_EMAIL", value: "daddyinnovation@gmail.com" },
        { key: "BACKUP_CRON_SCHEDULE", value: "0 2 * * *" }, // 每天凌晨2點
        { key: "NODE_ENV", value: "production" },
        { key: "TZ", value: "Asia/Hong_Kong" },
        { key: "AUTO_BACKUP_ENABLED", value: "true" }
    ],
    
    repo: "https://github.com/daddyinno/classmanage.git",
    branch: "main"
};

console.log(`
🎯 使用 Render MCP 創建備份服務的步驟：

1. 在 Cursor 中使用以下 MCP 命令：

// 創建備份服務
mcp_render_create_web_service({
    name: "${CRON_JOB_CONFIG.name}",
    runtime: "${CRON_JOB_CONFIG.runtime}",
    buildCommand: "${CRON_JOB_CONFIG.buildCommand}",
    startCommand: "${CRON_JOB_CONFIG.startCommand}",
    plan: "${CRON_JOB_CONFIG.plan}",
    region: "${CRON_JOB_CONFIG.region}",
    repo: "${CRON_JOB_CONFIG.repo}",
    branch: "${CRON_JOB_CONFIG.branch}",
    envVars: ${JSON.stringify(CRON_JOB_CONFIG.envVars, null, 8)}
});

2. 服務創建後，會自動：
   ✅ 每天凌晨 2:00 (Hong Kong 時間) 執行備份
   ✅ 將備份文件通過郵件發送到 ${CRON_JOB_CONFIG.envVars.find(e => e.key === 'BACKUP_TO_EMAIL').value}
   ✅ 發送備份成功/失敗通知

3. 監控和管理：
   - 訪問 Render Dashboard 查看服務狀態
   - 查看執行日誌和錯誤信息
   - 手動觸發備份（重啟服務）

📧 備份功能：
- 自動備份 SQLite 資料庫
- 壓縮並通過郵件發送
- 包含學生數據、分數記錄等
- 發送執行狀態通知

🔄 備份頻率：
- 默認：每天凌晨 2:00
- 可通過環境變數 BACKUP_CRON_SCHEDULE 調整

💡 提示：
- 第一次部署後，備份服務會立即啟動
- 可以通過 Render Dashboard 查看實時日誌
- 如需修改備份時間，更新環境變數即可
`);

module.exports = CRON_JOB_CONFIG;
