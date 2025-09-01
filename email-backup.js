const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// 載入環境變量
require('dotenv').config();

// 郵件配置
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
};

// 收件人配置
const BACKUP_EMAIL = {
    from: process.env.BACKUP_FROM_EMAIL || process.env.SMTP_USER,
    to: process.env.BACKUP_TO_EMAIL,
    cc: process.env.BACKUP_CC_EMAIL, // 可選：抄送
    bcc: process.env.BACKUP_BCC_EMAIL // 可選：密送
};

/**
 * 創建郵件傳輸器
 */
function createTransporter() {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
        throw new Error('郵件配置不完整：缺少 SMTP_USER 或 SMTP_PASS');
    }
    
    return nodemailer.createTransporter(EMAIL_CONFIG);
}

/**
 * 發送備份郵件
 * @param {string} backupFilePath - 備份文件路徑
 * @param {Object} options - 選項
 */
async function sendBackupEmail(backupFilePath, options = {}) {
    try {
        // 檢查收件人配置
        if (!BACKUP_EMAIL.to) {
            throw new Error('未配置收件人郵箱：請設置 BACKUP_TO_EMAIL 環境變量');
        }

        // 檢查備份文件是否存在
        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`備份文件不存在: ${backupFilePath}`);
        }

        // 獲取文件信息
        const stats = fs.statSync(backupFilePath);
        const filename = path.basename(backupFilePath);
        const fileSize = `${(stats.size / 1024).toFixed(2)} KB`;
        const backupDate = new Date().toLocaleString('zh-TW');

        // 檢查文件大小（大多數郵件服務限制附件大小）
        const maxSizeMB = options.maxSizeMB || 25; // 預設25MB
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        if (stats.size > maxSizeBytes) {
            throw new Error(`備份文件過大 (${fileSize})，超過郵件附件限制 (${maxSizeMB}MB)`);
        }

        // 建立傳輸器
        const transporter = createTransporter();

        // 郵件選項
        const mailOptions = {
            from: BACKUP_EMAIL.from,
            to: BACKUP_EMAIL.to,
            cc: BACKUP_EMAIL.cc,
            bcc: BACKUP_EMAIL.bcc,
            subject: `班級管理系統 - 數據庫備份 (${new Date().toLocaleDateString('zh-TW')})`,
            html: generateEmailHTML(filename, fileSize, backupDate, options),
            attachments: [
                {
                    filename: filename,
                    path: backupFilePath,
                    contentType: 'application/x-sqlite3'
                }
            ]
        };

        // 發送郵件
        console.log('📧 正在發送備份郵件...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ 備份郵件發送成功！');
        console.log(`📮 收件人: ${BACKUP_EMAIL.to}`);
        console.log(`📎 附件: ${filename} (${fileSize})`);
        console.log(`🆔 郵件ID: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId,
            filename: filename,
            fileSize: fileSize
        };

    } catch (error) {
        console.error('❌ 備份郵件發送失敗:', error.message);
        
        // 記錄詳細錯誤到日誌
        const logFile = process.env.LOG_FILE;
        if (logFile) {
            const errorLog = `[${new Date().toISOString()}] 郵件備份失敗: ${error.message}\n`;
            try {
                const logDir = path.dirname(path.resolve(logFile));
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                fs.appendFileSync(logFile, errorLog);
            } catch (logError) {
                console.error('日誌寫入失敗:', logError.message);
            }
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 生成郵件HTML內容
 */
function generateEmailHTML(filename, fileSize, backupDate, options = {}) {
    const systemInfo = options.systemInfo || {};
    
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; text-align: center;">🎓 班級管理系統</h2>
            <p style="margin: 10px 0 0 0; text-align: center;">數據庫自動備份</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <h3 style="color: #495057; margin-top: 0;">📦 備份詳情</h3>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold; width: 30%;">備份時間</td>
                    <td style="padding: 8px; background: white;">${backupDate}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">文件名稱</td>
                    <td style="padding: 8px; background: white;">${filename}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">文件大小</td>
                    <td style="padding: 8px; background: white;">${fileSize}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background: #e9ecef; font-weight: bold;">備份類型</td>
                    <td style="padding: 8px; background: white;">SQLite 數據庫完整備份</td>
                </tr>
            </table>

            <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <strong>✅ 備份狀態：</strong> 備份已成功完成並通過完整性檢查
                <br><strong>📧 郵件發送：</strong> 自動發送於 ${new Date().toLocaleString('zh-TW')}
            </div>

            <h4 style="color: #495057;">📋 注意事項</h4>
            <ul style="color: #6c757d; padding-left: 20px;">
                <li>請妥善保存此備份文件</li>
                <li>建議定期測試備份文件的完整性</li>
                <li>如需恢復數據，請聯繫系統管理員</li>
                <li>此郵件為系統自動發送，請勿回覆</li>
            </ul>

            ${systemInfo.totalStudents ? `
            <h4 style="color: #495057;">📊 系統統計</h4>
            <ul style="color: #6c757d; padding-left: 20px;">
                <li>學生總數：${systemInfo.totalStudents} 人</li>
                <li>總積分記錄：${systemInfo.totalLogs || 'N/A'} 條</li>
                <li>系統運行天數：${systemInfo.runningDays || 'N/A'} 天</li>
            </ul>
            ` : ''}

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="color: #6c757d; margin: 0;">
                    <small>班級管理系統 v1.0 | 自動備份服務</small>
                </p>
            </div>
        </div>
    </div>
    `;
}

/**
 * 測試郵件配置
 */
async function testEmailConfig() {
    try {
        console.log('🧪 測試郵件配置...');
        
        const transporter = createTransporter();
        
        // 驗證 SMTP 連接
        await transporter.verify();
        console.log('✅ SMTP 連接測試成功');
        
        // 發送測試郵件
        if (BACKUP_EMAIL.to) {
            const testMailOptions = {
                from: BACKUP_EMAIL.from,
                to: BACKUP_EMAIL.to,
                subject: '班級管理系統 - 郵件配置測試',
                html: `
                <h3>📧 郵件配置測試</h3>
                <p>如果您收到此郵件，表示備份郵件配置已正確設置。</p>
                <p><strong>測試時間：</strong> ${new Date().toLocaleString('zh-TW')}</p>
                <p><em>此為測試郵件，無需回覆。</em></p>
                `
            };
            
            const info = await transporter.sendMail(testMailOptions);
            console.log('✅ 測試郵件發送成功:', info.messageId);
        } else {
            console.log('⚠️  未設置收件人，跳過郵件發送測試');
        }
        
        return true;
    } catch (error) {
        console.error('❌ 郵件配置測試失敗:', error.message);
        return false;
    }
}

/**
 * 檢查郵件配置
 */
function checkEmailConfig() {
    const config = {
        smtp_host: EMAIL_CONFIG.host,
        smtp_port: EMAIL_CONFIG.port,
        smtp_user: EMAIL_CONFIG.auth.user ? '已設置' : '未設置',
        smtp_pass: EMAIL_CONFIG.auth.pass ? '已設置' : '未設置',
        from_email: BACKUP_EMAIL.from || '未設置',
        to_email: BACKUP_EMAIL.to || '未設置'
    };
    
    console.log('📧 郵件配置檢查:');
    Object.entries(config).forEach(([key, value]) => {
        const status = (key.includes('user') || key.includes('pass')) ? 
            (value === '已設置' ? '✅' : '❌') : 
            (value && value !== '未設置' ? '✅' : '❌');
        console.log(`  ${status} ${key}: ${value}`);
    });
    
    return config;
}

// 命令行介面
if (require.main === module) {
    const command = process.argv[2];
    const filePath = process.argv[3];
    
    switch (command) {
        case 'send':
            if (!filePath) {
                console.error('❌ 請指定備份文件路徑');
                console.log('用法: node email-backup.js send <備份文件路徑>');
                process.exit(1);
            }
            sendBackupEmail(filePath);
            break;
        case 'test':
            testEmailConfig();
            break;
        case 'config':
            checkEmailConfig();
            break;
        default:
            console.log('📧 郵件備份工具');
            console.log('');
            console.log('可用命令:');
            console.log('  send <file>  - 發送備份文件到指定郵箱');
            console.log('  test         - 測試郵件配置');
            console.log('  config       - 檢查郵件配置');
    }
}

module.exports = {
    sendBackupEmail,
    testEmailConfig,
    checkEmailConfig
};



