#!/usr/bin/env node

/**
 * 定時備份腳本
 * 用於設置自動備份任務
 * 
 * 使用方法:
 * 1. 直接運行: node cron-backup.js
 * 2. 設置 crontab: 0 2 * * * /path/to/node /path/to/cron-backup.js
 */

const backup = require('./backup');
const path = require('path');

// 讀取環境變量
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runScheduledBackup() {
    console.log('🕐 定時備份任務開始 -', new Date().toLocaleString('zh-TW'));
    
    try {
        // 檢查是否啟用自動備份
        const autoBackupEnabled = process.env.AUTO_BACKUP_ENABLED !== 'false';
        
        if (!autoBackupEnabled) {
            console.log('⚠️  自動備份已禁用，跳過備份任務');
            return;
        }

        // 執行備份
        const success = await backup.performBackup({
            cloud: true,  // 包含雲端備份
            force: false  // 不強制備份（會檢查數據庫完整性）
        });

        if (success) {
            console.log('✅ 定時備份任務完成 -', new Date().toLocaleString('zh-TW'));
            
            // 記錄到日誌文件（如果配置了）
            const logFile = process.env.LOG_FILE;
            if (logFile) {
                const fs = require('fs');
                const logDir = path.dirname(path.resolve(logFile));
                
                // 確保日誌目錄存在
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                
                const logMessage = `[${new Date().toISOString()}] 定時備份成功完成\n`;
                fs.appendFileSync(logFile, logMessage);
            }
        } else {
            throw new Error('備份執行失敗');
        }
        
    } catch (error) {
        console.error('❌ 定時備份任務失敗:', error.message);
        
        // 記錄錯誤到日誌文件
        const logFile = process.env.LOG_FILE;
        if (logFile) {
            const fs = require('fs');
            const logDir = path.dirname(path.resolve(logFile));
            
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const errorLog = `[${new Date().toISOString()}] 定時備份失敗: ${error.message}\n`;
            fs.appendFileSync(logFile, errorLog);
        }
        
        // 可以在這裡添加通知機制（郵件、Slack等）
        // await sendNotification('backup_failed', error.message);
        
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runScheduledBackup();
}

module.exports = {
    runScheduledBackup
};


