#!/usr/bin/env node

/**
 * Render MCP 備份管理器
 * 使用 Render MCP 創建和管理定期備份 Cron Job
 */

require('dotenv').config();

// Render MCP 需要你先設置 API Token 和選擇 workspace
// 這個腳本展示如何使用 Render MCP 創建服務

const BACKUP_CRON_JOB_CONFIG = {
    // Cron Job 配置
    name: "classmanage-backup-cron",
    type: "cron_job",
    schedule: "0 2 * * *", // 每天凌晨 2:00 執行
    command: "node backup-cron-job.js",
    
    // 環境變數
    envVars: [
        { key: "MAIL_HOST", value: process.env.MAIL_HOST || "smtp.gmail.com" },
        { key: "MAIL_PORT", value: process.env.MAIL_PORT || "587" },
        { key: "MAIL_USERNAME", value: process.env.MAIL_USERNAME },
        { key: "MAIL_PASSWORD", value: process.env.MAIL_PASSWORD },
        { key: "MAIL_FROM_ADDRESS", value: process.env.MAIL_FROM_ADDRESS },
        { key: "BACKUP_TO_EMAIL", value: process.env.MAIL_USERNAME }, // 默認發送到同一郵箱
        { key: "NODE_ENV", value: "production" },
        { key: "TZ", value: "Asia/Hong_Kong" } // 設置時區
    ],
    
    // 代碼倉庫
    repo: "https://github.com/daddyinno/classmanage.git",
    branch: "main"
};

const BACKUP_WEB_SERVICE_CONFIG = {
    // 備份管理 Web 服務配置（用於監控和手動觸發）
    name: "classmanage-backup-manager",
    runtime: "node",
    buildCommand: "npm install",
    startCommand: "node backup-service.js",
    plan: "starter", // 免費方案
    
    // 環境變數
    envVars: [
        { key: "BACKUP_SERVICE_PORT", value: "3000" },
        { key: "MAIL_HOST", value: process.env.MAIL_HOST || "smtp.gmail.com" },
        { key: "MAIL_PORT", value: process.env.MAIL_PORT || "587" },
        { key: "MAIL_USERNAME", value: process.env.MAIL_USERNAME },
        { key: "MAIL_PASSWORD", value: process.env.MAIL_PASSWORD },
        { key: "BACKUP_TO_EMAIL", value: process.env.MAIL_USERNAME },
        { key: "MAIN_SERVICE_URL", value: "https://classmanage-system.onrender.com" },
        { key: "NODE_ENV", value: "production" }
    ],
    
    repo: "https://github.com/daddyinno/classmanage.git",
    branch: "main"
};

// 使用說明和配置指導
function showUsageInstructions() {
    console.log(`
🚀 Render MCP 備份系統設置指南
=====================================

📋 前置條件：
1. 在 Render 上設置 API Token
2. 選擇或創建 workspace
3. 確保代碼已推送到 GitHub

🔧 執行步驟：

步驟 1: 設置 Render API Token
▶ 訪問 https://dashboard.render.com/account/api-keys
▶ 創建新的 API Key
▶ 在 MCP 配置中設置此 token

步驟 2: 選擇 Workspace
▶ 使用 render.selectWorkspace(workspaceId)

步驟 3: 創建 Cron Job (推薦)
▶ 創建配置: ${JSON.stringify(BACKUP_CRON_JOB_CONFIG, null, 2)}

步驟 4: 或創建 Web 服務進行監控
▶ 創建配置: ${JSON.stringify(BACKUP_WEB_SERVICE_CONFIG, null, 2)}

📧 郵件配置檢查：
- MAIL_USERNAME: ${process.env.MAIL_USERNAME ? '✅ 已設置' : '❌ 未設置'}
- MAIL_PASSWORD: ${process.env.MAIL_PASSWORD ? '✅ 已設置' : '❌ 未設置'}
- MAIL_HOST: ${process.env.MAIL_HOST || 'smtp.gmail.com'}

🎯 建議部署方式：
1. 主要服務 (classmanage-system) - 運行主應用
2. Cron Job (classmanage-backup-cron) - 定期備份
3. 備份監控服務 (classmanage-backup-manager) - 可選的監控面板

⚠️ 重要提醒：
- 確保所有環境變數都已正確設置
- Cron Job 會按照指定時間自動執行
- 備份完成後會自動發送郵件通知
- 可以通過 Render Dashboard 查看執行日誌
`);
}

// 驗證配置
function validateConfig() {
    const errors = [];
    
    if (!process.env.MAIL_USERNAME) {
        errors.push('❌ 缺少 MAIL_USERNAME 環境變數');
    }
    
    if (!process.env.MAIL_PASSWORD) {
        errors.push('❌ 缺少 MAIL_PASSWORD 環境變數');
    }
    
    if (BACKUP_CRON_JOB_CONFIG.repo.includes('your-username')) {
        errors.push('❌ 請更新 GitHub 倉庫 URL');
    }
    
    if (BACKUP_WEB_SERVICE_CONFIG.envVars.find(env => env.value && env.value.includes('your-main-service'))) {
        errors.push('❌ 請更新主服務 URL');
    }
    
    if (errors.length > 0) {
        console.log('\n🚨 配置檢查失敗：');
        errors.forEach(error => console.log(error));
        console.log('\n請修正以上問題後重新執行。\n');
        return false;
    }
    
    console.log('✅ 配置檢查通過！');
    return true;
}

// 主函數
function main() {
    console.log('🔧 Render MCP 備份管理器');
    console.log('============================\n');
    
    if (!validateConfig()) {
        process.exit(1);
    }
    
    showUsageInstructions();
    
    console.log(`
📝 下一步操作：
1. 設置 Render API Token (如果尚未設置)
2. 運行 MCP 命令創建 Cron Job
3. 監控備份執行狀態

💡 提示：
- 第一次備份會在今晚 2:00 AM (Hong Kong 時間) 執行
- 可以隨時通過 Render Dashboard 手動觸發
- 所有備份記錄都會保存在 Render 日誌中
    `);
}

// 如果直接執行此腳本
if (require.main === module) {
    main();
}

module.exports = {
    BACKUP_CRON_JOB_CONFIG,
    BACKUP_WEB_SERVICE_CONFIG,
    validateConfig,
    showUsageInstructions
};
