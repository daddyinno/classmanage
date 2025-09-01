#!/usr/bin/env node

/**
 * 專用備份服務 - 由 Render MCP 管理
 * 功能：定時備份資料庫並發送郵件
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const backup = require('./backup');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKUP_SERVICE_PORT || 3001;

// 中間件
app.use(cors());
app.use(express.json());

// 備份服務狀態
let backupStatus = {
    lastBackup: null,
    nextBackup: null,
    isRunning: false,
    totalBackups: 0,
    errors: []
};

// API 端點
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: '班級管理系統備份服務',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        backupStatus
    });
});

app.get('/backup/status', (req, res) => {
    res.json(backupStatus);
});

app.post('/backup/trigger', async (req, res) => {
    try {
        console.log('🔄 手動觸發備份任務');
        
        backupStatus.isRunning = true;
        const result = await performBackup();
        
        res.json({
            success: true,
            message: '備份成功完成',
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ 手動備份失敗:', error);
        backupStatus.errors.push({
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: '備份失敗',
            error: error.message
        });
    } finally {
        backupStatus.isRunning = false;
    }
});

// 執行備份的核心函數
async function performBackup() {
    try {
        console.log('📦 開始執行備份...');
        
        // 更新狀態
        backupStatus.isRunning = true;
        backupStatus.lastBackup = new Date().toISOString();
        
        // 執行備份（使用現有的備份模組）
        const result = await new Promise((resolve, reject) => {
            backup.performBackup('email', (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        
        // 更新統計
        backupStatus.totalBackups++;
        
        console.log('✅ 備份完成:', result);
        return result;
        
    } catch (error) {
        console.error('❌ 備份失敗:', error);
        backupStatus.errors.push({
            error: error.message,
            timestamp: new Date().toISOString()
        });
        throw error;
    } finally {
        backupStatus.isRunning = false;
    }
}

// 設置定時備份任務
function setupCronJobs() {
    // 每天凌晨 2 點備份
    const backupSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';
    
    console.log(`📅 設置定時備份: ${backupSchedule}`);
    
    cron.schedule(backupSchedule, async () => {
        console.log('🕐 定時備份任務觸發');
        
        try {
            await performBackup();
        } catch (error) {
            console.error('❌ 定時備份失敗:', error);
        }
    }, {
        timezone: "Asia/Hong_Kong"
    });
    
    // 計算下次備份時間
    const nextBackup = cron.schedule(backupSchedule, () => {}).nextDates(1)[0];
    backupStatus.nextBackup = nextBackup.toISOString();
}

// 啟動服務
function startService() {
    app.listen(PORT, () => {
        console.log(`🚀 備份服務已啟動: http://localhost:${PORT}`);
        console.log(`📧 郵件配置: ${process.env.MAIL_HOST}:${process.env.MAIL_PORT}`);
        console.log(`📬 收件人: ${process.env.BACKUP_TO_EMAIL || process.env.MAIL_USERNAME}`);
        
        // 設置定時任務
        setupCronJobs();
        
        console.log('✅ 備份服務準備就緒');
    });
}

// 優雅關閉
process.on('SIGTERM', () => {
    console.log('🛑 收到終止信號，正在關閉服務...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 收到中斷信號，正在關閉服務...');
    process.exit(0);
});

// 啟動
startService();

module.exports = app;

