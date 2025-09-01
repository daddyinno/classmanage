#!/usr/bin/env node

/**
 * 使用 Render MCP 設置備份服務的指導腳本
 * 這個腳本展示如何通過代碼創建和管理 Render 服務
 */

// 這個腳本需要配置 Render API token 後才能執行

const BACKUP_SERVICE_CONFIG = {
    // 備份服務配置
    name: "classmanage-backup-service",
    runtime: "node",
    branch: "main",
    buildCommand: "npm install",
    startCommand: "node backup-service.js",
    
    // 環境變數配置
    envVars: [
        // 從主服務複製的配置
        { key: "MAIL_HOST", value: "smtp.gmail.com" },
        { key: "MAIL_PORT", value: "587" },
        { key: "MAIL_USERNAME", value: "daddyinnovation@gmail.com" },
        { key: "MAIL_PASSWORD", value: "hwuhevcsupbhdhie" },
        { key: "MAIL_FROM_ADDRESS", value: "daddyinnovation@gmail.com" },
        
        // 備份專用配置
        { key: "BACKUP_SERVICE_PORT", value: "3000" },
        { key: "BACKUP_CRON_SCHEDULE", value: "0 2 * * *" }, // 每日凌晨2點
        { key: "BACKUP_TO_EMAIL", value: "daddyinnovation@gmail.com" },
        { key: "AUTO_BACKUP_ENABLED", value: "true" },
        
        // 資料庫連接（需要指向主服務的資料庫）
        { key: "DB_PATH", value: "./classroom.db" },
        { key: "MAIN_SERVICE_URL", value: "https://classmanage-system.onrender.com" }
    ]
};

const MAIN_SERVICE_BACKUP_API = {
    // 在主服務中添加的備份 API 端點
    endpoints: [
        "GET /api/backup/status",
        "POST /api/backup/trigger", 
        "POST /api/backup/email",
        "GET /api/backup/logs"
    ]
};

console.log('🔧 Render MCP 備份服務配置:');
console.log('=====================================');
console.log(JSON.stringify(BACKUP_SERVICE_CONFIG, null, 2));

console.log('\n📋 設置步驟:');
console.log('1. 設置 Render API token');
console.log('2. 選擇 workspace'); 
console.log('3. 創建備份服務');
console.log('4. 配置環境變數');
console.log('5. 設置監控和警報');

module.exports = {
    BACKUP_SERVICE_CONFIG,
    MAIN_SERVICE_BACKUP_API
};

