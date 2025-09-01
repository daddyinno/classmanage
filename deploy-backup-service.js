#!/usr/bin/env node

/**
 * 使用 Render MCP 部署備份服務的腳本
 * 執行前請確保已經選擇正確的 workspace
 */

const deployConfig = {
    // 備份服務配置
    serviceName: "classmanage-backup-service",
    mainServiceName: "classmanage-main",
    
    // 服務配置
    webService: {
        name: "classmanage-backup-service",
        runtime: "node",
        buildCommand: "npm install",
        startCommand: "node backup-service.js",
        plan: "starter", // 免費方案
        region: "singapore", // 亞洲區域，適合香港時區
        repo: "https://github.com/daddyinno/classmanage.git",
        branch: "main",
        envVars: [
            { key: "BACKUP_SERVICE_PORT", value: "3000" },
            { key: "MAIL_HOST", value: "smtp.gmail.com" },
            { key: "MAIL_PORT", value: "587" },
            { key: "MAIL_USERNAME", value: "daddyinnovation@gmail.com" },
            { key: "MAIL_PASSWORD", value: "hwuhevcsupbhdhie" },
            { key: "MAIL_FROM_ADDRESS", value: "daddyinnovation@gmail.com" },
            { key: "BACKUP_TO_EMAIL", value: "daddyinnovation@gmail.com" },
            { key: "BACKUP_CRON_SCHEDULE", value: "0 2 * * *" }, // 每天凌晨2點
            { key: "AUTO_BACKUP_ENABLED", value: "true" },
            { key: "NODE_ENV", value: "production" },
            { key: "TZ", value: "Asia/Hong_Kong" },
            // 備份系統兼容性環境變數
            { key: "SMTP_HOST", value: "smtp.gmail.com" },
            { key: "SMTP_PORT", value: "587" },
            { key: "SMTP_USER", value: "daddyinnovation@gmail.com" },
            { key: "SMTP_PASS", value: "hwuhevcsupbhdhie" },
            { key: "BACKUP_FROM_EMAIL", value: "daddyinnovation@gmail.com" }
        ]
    }
};

// 顯示部署指南
function showDeploymentGuide() {
    console.log(`
🚀 Render MCP 備份服務部署指南
=====================================

📋 執行步驟：

1️⃣ 確認 Workspace
請確保你已經選擇了正確的 Render workspace

2️⃣ 創建備份服務
使用以下 MCP 命令創建 Web 服務：

\`\`\`javascript
mcp_render_create_web_service(${JSON.stringify(deployConfig.webService, null, 2)})
\`\`\`

3️⃣ 服務功能
創建後，服務將：
✅ 每天凌晨 2:00 (香港時間) 自動執行備份
✅ 備份資料庫並通過郵件發送
✅ 發送成功/失敗通知郵件
✅ 提供備份狀態 API 端點
✅ 支援手動觸發備份

4️⃣ 監控和管理
- 服務 URL: https://${deployConfig.webService.name}.onrender.com
- 健康檢查: https://${deployConfig.webService.name}.onrender.com/health
- 備份狀態: https://${deployConfig.webService.name}.onrender.com/backup/status
- 手動觸發: POST https://${deployConfig.webService.name}.onrender.com/backup/trigger

📧 郵件通知
備份完成後會發送郵件到: ${deployConfig.webService.envVars.find(e => e.key === 'BACKUP_TO_EMAIL').value}

⏰ 備份時間
默認時間: 每天凌晨 2:00 (香港時間)
可通過環境變數 BACKUP_CRON_SCHEDULE 調整

💡 注意事項：
- 首次部署可能需要 5-10 分鐘
- 服務會自動從 GitHub 倉庫部署
- 免費方案有一定的執行時間限制
- 可通過 Render Dashboard 查看實時日誌
`);
}

// 驗證配置
function validateConfiguration() {
    console.log('🔍 驗證配置...');
    
    const checks = [
        { name: 'GitHub 倉庫', value: deployConfig.webService.repo, valid: !deployConfig.webService.repo.includes('your-username') },
        { name: '郵件用戶', value: deployConfig.webService.envVars.find(e => e.key === 'MAIL_USERNAME')?.value, valid: true },
        { name: '郵件密碼', value: '***', valid: deployConfig.webService.envVars.find(e => e.key === 'MAIL_PASSWORD')?.value?.length > 0 },
        { name: '備份收件人', value: deployConfig.webService.envVars.find(e => e.key === 'BACKUP_TO_EMAIL')?.value, valid: true }
    ];
    
    console.log('\n配置檢查結果：');
    checks.forEach(check => {
        const status = check.valid ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${check.value}`);
    });
    
    const allValid = checks.every(check => check.valid);
    console.log(`\n${allValid ? '✅ 配置檢查通過' : '❌ 配置需要修正'}`);
    
    return allValid;
}

// 主函數
function main() {
    console.log('🔧 Render MCP 備份服務部署器');
    console.log('==============================\n');
    
    if (!validateConfiguration()) {
        console.log('請修正配置問題後重新執行');
        process.exit(1);
    }
    
    showDeploymentGuide();
}

if (require.main === module) {
    main();
}

module.exports = deployConfig;
