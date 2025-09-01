#!/usr/bin/env node

/**
 * Render Cron Job 專用備份腳本
 * 這個腳本將作為 Render Cron Job 執行，定期備份資料庫並發送郵件
 */

const backup = require('./backup');
const nodemailer = require('nodemailer');
require('dotenv').config();

// 記錄開始時間
const startTime = new Date();
console.log(`🕐 定期備份任務開始 - ${startTime.toLocaleString('zh-TW')}`);

// 創建日誌函數
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    return logMessage;
}

// 發送備份完成通知郵件
async function sendNotificationEmail(result, error = null) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || 'smtp.gmail.com',
            port: process.env.MAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD
            }
        });

        const subject = error ? 
            `❌ 班級管理系統 - 備份失敗通知` : 
            `✅ 班級管理系統 - 備份成功完成`;

        const htmlContent = error ? `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e74c3c;">❌ 備份任務失敗</h2>
                <p><strong>執行時間：</strong> ${startTime.toLocaleString('zh-TW')}</p>
                <p><strong>錯誤訊息：</strong></p>
                <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; color: #e74c3c;">${error}</pre>
                <p>請檢查系統狀態並手動執行備份。</p>
                <hr>
                <p style="color: #666; font-size: 12px;">此郵件由 Render Cron Job 自動發送</p>
            </div>
        ` : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #27ae60;">✅ 備份任務成功完成</h2>
                <p><strong>執行時間：</strong> ${startTime.toLocaleString('zh-TW')}</p>
                <p><strong>完成時間：</strong> ${new Date().toLocaleString('zh-TW')}</p>
                <p><strong>耗時：</strong> ${((new Date() - startTime) / 1000).toFixed(2)} 秒</p>
                
                ${result ? `
                    <h3>備份詳情：</h3>
                    <ul>
                        <li><strong>備份文件：</strong> ${result.backupFile || '未知'}</li>
                        <li><strong>文件大小：</strong> ${result.fileSize || '未知'}</li>
                        <li><strong>學生數量：</strong> ${result.studentCount || '未知'}</li>
                    </ul>
                ` : ''}
                
                <p style="color: #27ae60;">📧 資料庫備份已通過郵件發送，請查收附件。</p>
                <hr>
                <p style="color: #666; font-size: 12px;">此郵件由 Render Cron Job 自動發送</p>
            </div>
        `;

        await transporter.sendMail({
            from: `"班級管理系統" <${process.env.MAIL_USERNAME}>`,
            to: process.env.BACKUP_TO_EMAIL || process.env.MAIL_USERNAME,
            subject,
            html: htmlContent
        });

        log('✅ 通知郵件發送成功');
    } catch (emailError) {
        log(`❌ 發送通知郵件失敗: ${emailError.message}`, 'ERROR');
    }
}

// 主要備份執行函數
async function runBackupJob() {
    try {
        log('🔄 開始執行資料庫備份...');
        
        // 檢查必要的環境變數
        const requiredEnvVars = ['MAIL_USERNAME', 'MAIL_PASSWORD'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`);
        }

        // 執行備份（使用郵件模式）
        const result = await new Promise((resolve, reject) => {
            backup.performBackup('email', (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });

        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        log(`✅ 備份成功完成 - 耗時: ${duration}秒`);
        log(`📧 備份結果: ${JSON.stringify(result, null, 2)}`);

        // 發送成功通知（不包含附件的通知郵件）
        await sendNotificationEmail(result);
        
        // 設置退出碼
        process.exitCode = 0;
        
    } catch (error) {
        const errorMessage = error.message || error.toString();
        log(`❌ 備份任務失敗: ${errorMessage}`, 'ERROR');
        
        // 發送失敗通知
        await sendNotificationEmail(null, errorMessage);
        
        // 設置退出碼
        process.exitCode = 1;
        
    } finally {
        const endTime = new Date();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
        log(`🏁 任務結束 - 總耗時: ${totalDuration}秒`);
        
        // 給郵件發送一點時間
        setTimeout(() => {
            process.exit(process.exitCode);
        }, 2000);
    }
}

// 執行備份任務
runBackupJob().catch(error => {
    log(`💥 未捕獲的錯誤: ${error.message}`, 'ERROR');
    process.exit(1);
});

// 處理進程信號
process.on('SIGTERM', () => {
    log('🛑 收到 SIGTERM 信號，正在退出...', 'WARN');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('🛑 收到 SIGINT 信號，正在退出...', 'WARN');
    process.exit(0);
});

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
    log(`💥 未捕獲的異常: ${error.message}`, 'ERROR');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`💥 未處理的 Promise 拒絕: ${reason}`, 'ERROR');
    process.exit(1);
});
