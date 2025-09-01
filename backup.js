const fs = require('fs');
const path = require('path');
const https = require('https');
const emailBackup = require('./email-backup');

// 配置
const DB_PATH = path.join(__dirname, 'classroom.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_LOCAL_BACKUPS = 7; // 保留最近7天的本地備份

// 創建備份目錄
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 生成備份文件名（包含時間戳）
function generateBackupFilename() {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
    return `classroom_backup_${timestamp}.db`;
}

// 本地備份
function createLocalBackup() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            console.error('❌ 數據庫文件不存在:', DB_PATH);
            return false;
        }

        const backupFilename = generateBackupFilename();
        const backupPath = path.join(BACKUP_DIR, backupFilename);
        
        // 複製數據庫文件
        fs.copyFileSync(DB_PATH, backupPath);
        
        console.log('✅ 本地備份完成:', backupFilename);
        return backupPath;
    } catch (error) {
        console.error('❌ 本地備份失敗:', error.message);
        return false;
    }
}

// 清理舊的本地備份
function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('classroom_backup_') && file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        // 刪除超過限制的舊備份
        if (files.length > MAX_LOCAL_BACKUPS) {
            const filesToDelete = files.slice(MAX_LOCAL_BACKUPS);
            filesToDelete.forEach(file => {
                fs.unlinkSync(file.path);
                console.log('🗑️  刪除舊備份:', file.name);
            });
        }
    } catch (error) {
        console.error('❌ 清理舊備份失敗:', error.message);
    }
}

// 上傳到雲端存儲 (示例：使用webhook或API)
async function uploadToCloud(backupPath) {
    const WEBHOOK_URL = process.env.BACKUP_WEBHOOK_URL;
    const API_KEY = process.env.BACKUP_API_KEY;
    
    if (!WEBHOOK_URL) {
        console.log('⚠️  未配置雲端備份URL，跳過雲端上傳');
        return false;
    }

    try {
        // 讀取備份文件
        const backupData = fs.readFileSync(backupPath);
        const filename = path.basename(backupPath);
        
        // 準備上傳數據
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
        const payload = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="file"; filename="${filename}"`,
            'Content-Type: application/octet-stream',
            '',
            backupData,
            `--${boundary}--`
        ].join('\r\n');

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': API_KEY ? `Bearer ${API_KEY}` : undefined
            }
        };

        // 發送請求
        return new Promise((resolve, reject) => {
            const req = https.request(WEBHOOK_URL, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log('☁️  雲端備份成功:', filename);
                        resolve(true);
                    } else {
                        console.error('❌ 雲端備份失敗:', res.statusCode, data);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ 雲端備份請求失敗:', error.message);
                resolve(false);
            });

            req.write(payload);
            req.end();
        });
    } catch (error) {
        console.error('❌ 雲端備份失敗:', error.message);
        return false;
    }
}

// 檢查數據庫完整性
function checkDatabaseIntegrity() {
    const sqlite3 = require('sqlite3').verbose();
    
    return new Promise((resolve) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ 數據庫連接失敗:', err.message);
                resolve(false);
                return;
            }

            db.get("PRAGMA integrity_check", (err, row) => {
                if (err) {
                    console.error('❌ 數據庫完整性檢查失敗:', err.message);
                    resolve(false);
                } else if (row.integrity_check === 'ok') {
                    console.log('✅ 數據庫完整性檢查通過');
                    resolve(true);
                } else {
                    console.error('❌ 數據庫完整性檢查失敗:', row.integrity_check);
                    resolve(false);
                }
                
                db.close();
            });
        });
    });
}

// 獲取系統統計信息
function getSystemInfo() {
    const sqlite3 = require('sqlite3').verbose();
    
    return new Promise((resolve) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ 無法獲取系統統計:', err.message);
                resolve({});
                return;
            }

            const systemInfo = {};
            let completed = 0;
            const total = 3;

            function checkComplete() {
                completed++;
                if (completed === total) {
                    db.close();
                    resolve(systemInfo);
                }
            }

            // 獲取學生總數
            db.get("SELECT COUNT(*) as count FROM students", (err, row) => {
                if (!err && row) {
                    systemInfo.totalStudents = row.count;
                }
                checkComplete();
            });

            // 獲取積分記錄總數
            db.get("SELECT COUNT(*) as count FROM point_logs", (err, row) => {
                if (!err && row) {
                    systemInfo.totalLogs = row.count;
                }
                checkComplete();
            });

            // 計算系統運行天數（基於最早的學生記錄）
            db.get("SELECT MIN(created_at) as earliest FROM students", (err, row) => {
                if (!err && row && row.earliest) {
                    const earliest = new Date(row.earliest);
                    const now = new Date();
                    const diffTime = Math.abs(now - earliest);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    systemInfo.runningDays = diffDays;
                }
                checkComplete();
            });
        });
    });
}

// 執行完整備份流程
async function performBackup(options = {}) {
    console.log('📦 開始執行數據庫備份...');
    
    // 檢查數據庫完整性
    const isIntegrityOk = await checkDatabaseIntegrity();
    if (!isIntegrityOk && !options.force) {
        console.error('❌ 數據庫完整性檢查失敗，備份中止');
        return false;
    }

    // 創建本地備份
    const backupPath = createLocalBackup();
    if (!backupPath) {
        return false;
    }

    // 收集系統統計信息（用於郵件）
    const systemInfo = await getSystemInfo();

    // 上傳到雲端（如果配置了）
    if (options.cloud !== false) {
        await uploadToCloud(backupPath);
    }

    // 發送備份郵件（如果配置了）
    if (options.email !== false && process.env.BACKUP_TO_EMAIL) {
        try {
            console.log('📧 發送備份郵件...');
            const emailResult = await emailBackup.sendBackupEmail(backupPath, { systemInfo });
            if (emailResult.success) {
                console.log('✅ 備份郵件發送成功');
            } else {
                console.log('⚠️  備份郵件發送失敗:', emailResult.error);
            }
        } catch (error) {
            console.error('❌ 郵件發送過程出錯:', error.message);
        }
    } else if (options.email !== false) {
        console.log('⚠️  未配置郵件，跳過郵件備份');
    }

    // 清理舊備份
    cleanupOldBackups();

    console.log('✅ 備份流程完成');
    return true;
}

// 恢復數據庫
function restoreDatabase(backupPath) {
    try {
        if (!fs.existsSync(backupPath)) {
            console.error('❌ 備份文件不存在:', backupPath);
            return false;
        }

        // 創建原數據庫的備份
        const originalBackup = DB_PATH + '.original_' + Date.now();
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, originalBackup);
            console.log('📦 原數據庫已備份為:', originalBackup);
        }

        // 恢復數據庫
        fs.copyFileSync(backupPath, DB_PATH);
        console.log('✅ 數據庫恢復完成');
        
        return true;
    } catch (error) {
        console.error('❌ 數據庫恢復失敗:', error.message);
        return false;
    }
}

// 列出所有備份
function listBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('classroom_backup_') && file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    size: `${(stats.size / 1024).toFixed(2)} KB`,
                    created: stats.mtime.toLocaleString('zh-TW')
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        console.log('\n📋 可用的備份文件:');
        files.forEach((file, index) => {
            console.log(`${index + 1}. ${file.filename}`);
            console.log(`   大小: ${file.size} | 創建時間: ${file.created}`);
        });
        
        return files;
    } catch (error) {
        console.error('❌ 列出備份失敗:', error.message);
        return [];
    }
}

// 命令行介面
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'backup':
            performBackup({ cloud: true, email: true });
            break;
        case 'backup-local':
            performBackup({ cloud: false, email: false });
            break;
        case 'backup-email':
            performBackup({ cloud: false, email: true });
            break;
        case 'restore':
            const backupPath = process.argv[3];
            if (!backupPath) {
                console.error('❌ 請指定備份文件路徑');
                console.log('用法: node backup.js restore <備份文件路徑>');
                process.exit(1);
            }
            restoreDatabase(backupPath);
            break;
        case 'list':
            listBackups();
            break;
        case 'check':
            checkDatabaseIntegrity();
            break;
        case 'email-test':
            emailBackup.testEmailConfig();
            break;
        case 'email-config':
            emailBackup.checkEmailConfig();
            break;
        case 'email-send':
            const emailBackupPath = process.argv[3];
            if (!emailBackupPath) {
                console.error('❌ 請指定備份文件路徑');
                console.log('用法: node backup.js email-send <備份文件路徑>');
                process.exit(1);
            }
            emailBackup.sendBackupEmail(emailBackupPath);
            break;
        default:
            console.log('📋 可用命令:');
            console.log('  backup      - 執行完整備份（包含雲端和郵件）');
            console.log('  backup-local - 僅本地備份');
            console.log('  backup-email - 本地備份並發送郵件');
            console.log('  restore <file> - 恢復數據庫');
            console.log('  list        - 列出所有備份');
            console.log('  check       - 檢查數據庫完整性');
            console.log('');
            console.log('📧 郵件相關命令:');
            console.log('  email-test  - 測試郵件配置');
            console.log('  email-config - 檢查郵件配置');
            console.log('  email-send <file> - 發送指定備份文件到郵箱');
    }
}

module.exports = {
    performBackup,
    restoreDatabase,
    listBackups,
    checkDatabaseIntegrity
};
