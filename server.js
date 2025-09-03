const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const database = require('./database');

// 載入環境變量
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || ''; // 支援子文件夾部署，例如 '/subfolder'

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 支援子文件夾部署的靜態文件服務
if (BASE_PATH) {
    app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
    console.log(`📁 靜態文件將在 ${BASE_PATH} 路徑下提供服務`);
} else {
    app.use(express.static(path.join(__dirname, 'public')));
}

// 簡單的權限檢查中間件
function requireTeacherAuth(req, res, next) {
    const authHeader = req.headers['x-teacher-mode'];
    
    // 添加詳細日誌
    console.log(`🔐 權限檢查: X-Teacher-Mode=${authHeader}, 路徑=${req.path}, 方法=${req.method}`);
    
    // 如果有特定的老師模式標頭，允許通過
    if (authHeader === 'true') {
        console.log(`✅ 老師權限驗證通過`);
        next();
    } else {
        console.log(`❌ 權限驗證失敗: 需要老師權限`);
        res.status(403).json({ 
            error: '需要老師權限', 
            message: '此操作需要老師權限才能執行' 
        });
    }
}

// ============ 數據庫還原和初始化 ============
const DatabaseRestoreManager = require('./db-restore-on-startup');

// 啟動時還原數據庫（如果需要）
async function initializeDatabaseWithRestore() {
    try {
        const restoreManager = new DatabaseRestoreManager();
        
        // 檢查並還原數據庫
        const restored = await restoreManager.restoreDatabase();
        if (restored) {
            console.log('🎯 數據庫還原檢查完成');
            
            // 初始化數據庫
            database.initializeDatabase();
            
            // 延遲執行啟動備份
            setTimeout(() => {
                restoreManager.performStartupBackup();
            }, 5000);
            
        } else {
            console.error('❌ 數據庫還原失敗');
        }
    } catch (error) {
        console.error('💥 數據庫初始化錯誤:', error.message);
        // 即使還原失敗，也嘗試初始化數據庫
        database.initializeDatabase();
    }
}

// 執行數據庫初始化
initializeDatabaseWithRestore();

// 創建API路由器以支援子文件夾部署
const apiRouter = express.Router();

// 获取所有学生
apiRouter.get('/students', (req, res) => {
    database.getAllStudents((err, students) => {
        if (err) {
            return res.status(500).json({ error: '获取学生列表失败' });
        }
        res.json(students);
    });
});

// 添加学生
apiRouter.post('/students', requireTeacherAuth, (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: '学生姓名不能为空' });
    }
    
    database.addStudent(name.trim(), function(err) {
        if (err) {
            return res.status(500).json({ error: '添加学生失败' });
        }
        res.json({ message: '学生添加成功', studentId: this.lastID });
    });
});

// 全班加减分 - 必须放在单个学生路由之前，避免路由冲突
apiRouter.post('/students/all/points', requireTeacherAuth, (req, res) => {
    const { points, reason } = req.body;
    
    if (isNaN(points)) {
        return res.status(400).json({ error: '无效的积分数值' });
    }
    
    database.updateAllStudentsPoints(points, reason || '全班调整', (err) => {
        if (err) {
            return res.status(500).json({ error: '批量更新积分失败' });
        }
        res.json({ message: '全班积分更新成功' });
    });
});

// 更新单个学生积分
apiRouter.post('/students/:id/points', requireTeacherAuth, (req, res) => {
    const studentId = parseInt(req.params.id);
    const { points, reason } = req.body;
    
    if (isNaN(studentId) || isNaN(points)) {
        return res.status(400).json({ error: '无效的参数' });
    }
    
    // 添加詳細日誌
    console.log(`📝 更新積分請求: 學生ID=${studentId}, 積分變化=${points}, 理由="${reason || '手动调整'}"`);
    
    database.updateStudentPoints(studentId, points, reason || '手动调整', (err) => {
        if (err) {
            console.error(`❌ 更新積分失敗: 學生ID=${studentId}, 錯誤=`, err);
            return res.status(500).json({ error: '更新积分失败' });
        }
        console.log(`✅ 積分更新成功: 學生ID=${studentId}, 積分變化=${points}`);
        res.json({ message: '积分更新成功' });
    });
});

// 获取积分记录
apiRouter.get('/logs/:studentId?', (req, res) => {
    const studentId = req.params.studentId ? parseInt(req.params.studentId) : null;
    
    database.getPointLogs(studentId, (err, logs) => {
        if (err) {
            return res.status(500).json({ error: '获取记录失败' });
        }
        res.json(logs);
    });
});

// 删除学生
apiRouter.delete('/students/:id', requireTeacherAuth, (req, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
        return res.status(400).json({ error: '无效的学生ID' });
    }
    
    database.deleteStudent(studentId, (err) => {
        if (err) {
            return res.status(500).json({ error: '删除学生失败' });
        }
        res.json({ message: '学生删除成功' });
    });
});

// 更新學生錢包積分（正面行為會增加錢包積分）
apiRouter.post('/students/:id/wallet', requireTeacherAuth, (req, res) => {
    const studentId = parseInt(req.params.id);
    const { points } = req.body;
    
    if (isNaN(studentId) || isNaN(points)) {
        return res.status(400).json({ error: '無效的參數' });
    }
    
    database.updateWalletPoints(studentId, points, (err) => {
        if (err) {
            return res.status(500).json({ error: '更新錢包積分失敗' });
        }
        res.json({ message: '錢包積分更新成功' });
    });
});

// 餵食學生（更新最後餵食時間）
apiRouter.post('/students/:id/feed', requireTeacherAuth, (req, res) => {
    const studentId = parseInt(req.params.id);
    
    database.updateLastFedTime(studentId, (err) => {
        if (err) {
            return res.status(500).json({ error: '更新餵食時間失敗' });
        }
        res.json({ message: '餵食時間更新成功' });
    });
});

// 獲取購買記錄
apiRouter.get('/purchases', (req, res) => {
    const studentId = req.query.student_id ? parseInt(req.query.student_id) : null;
    
    database.getPurchases(studentId, (err, purchases) => {
        if (err) {
            return res.status(500).json({ error: '獲取購買記錄失敗' });
        }
        res.json(purchases);
    });
});

// ============ 飢餓系統 API ============

// 獲取飢餓學生列表
apiRouter.get('/students/hungry', requireTeacherAuth, (req, res) => {
    database.getHungryStudents((err, hungryStudents) => {
        if (err) {
            return res.status(500).json({ error: '獲取飢餓學生失敗' });
        }
        res.json(hungryStudents);
    });
});

// 手動處理飢餓降級
apiRouter.post('/students/process-hunger', requireTeacherAuth, (req, res) => {
    database.processAllHungryStudents((err, results) => {
        if (err) {
            return res.status(500).json({ error: '處理飢餓降級失敗' });
        }
        res.json({ 
            message: '飢餓降級處理完成',
            processedStudents: results.length,
            results: results
        });
    });
});

// 重置所有學生資料
apiRouter.post('/students/reset-all', requireTeacherAuth, (req, res) => {
    database.resetAllStudentsData((err, result) => {
        if (err) {
            return res.status(500).json({ error: '重置資料失敗' });
        }
        res.json({ 
            message: '所有學生資料已重置',
            result: result
        });
    });
});

// 获取阶段信息 (10级系统，每20分一级)
apiRouter.get('/stages', (req, res) => {
    const stages = [
        { name: 'level1', min: 0, max: 19, description: '第1級', emoji: '1️⃣' },
        { name: 'level2', min: 20, max: 39, description: '第2級', emoji: '2️⃣' },
        { name: 'level3', min: 40, max: 59, description: '第3級', emoji: '3️⃣' },
        { name: 'level4', min: 60, max: 79, description: '第4級', emoji: '4️⃣' },
        { name: 'level5', min: 80, max: 99, description: '第5級', emoji: '5️⃣' },
        { name: 'level6', min: 100, max: 119, description: '第6級', emoji: '6️⃣' },
        { name: 'level7', min: 120, max: 139, description: '第7級', emoji: '7️⃣' },
        { name: 'level8', min: 140, max: 159, description: '第8級', emoji: '8️⃣' },
        { name: 'level9', min: 160, max: 179, description: '第9級', emoji: '9️⃣' },
        { name: 'level10', min: 180, max: 999999, description: '第10級', emoji: '🔟' }
    ];
    res.json(stages);
});

// 驗證老師密碼
apiRouter.post('/auth/verify-teacher', (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: '密碼不能為空' });
    }
    
    database.verifyTeacherPassword(password, (err, isValid) => {
        if (err) {
            console.error('Password verification error:', err);
            return res.status(500).json({ error: '密碼驗證失敗' });
        }
        
        if (isValid) {
            res.json({ success: true, message: '密碼驗證成功' });
        } else {
            res.status(401).json({ success: false, error: '密碼錯誤' });
        }
    });
});

// 更新老師密碼 (需要先驗證當前密碼)
apiRouter.post('/auth/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '當前密碼和新密碼不能為空' });
    }
    
    // 先驗證當前密碼
    database.verifyTeacherPassword(currentPassword, (err, isValid) => {
        if (err) {
            console.error('Password verification error:', err);
            return res.status(500).json({ error: '密碼驗證失敗' });
        }
        
        if (!isValid) {
            return res.status(401).json({ error: '當前密碼錯誤' });
        }
        
        // 更新為新密碼
        database.updateSystemConfig('teacher_password', newPassword, (updateErr) => {
            if (updateErr) {
                console.error('Password update error:', updateErr);
                return res.status(500).json({ error: '密碼更新失敗' });
            }
            
            res.json({ success: true, message: '密碼更新成功' });
        });
    });
});

// 获取学生排行榜
apiRouter.get('/ranking/:period?', (req, res) => {
    const period = req.params.period || 'all';
    
    database.db.all("SELECT * FROM students ORDER BY points DESC", (err, students) => {
        if (err) {
            console.error('Error fetching students for ranking:', err.message);
            res.status(500).json({ error: '获取排行榜失败' });
            return;
        }

        const rankedStudents = students.map(student => {
            const stageInfo = getStageInfo(student.stage);
            return {
                id: student.id,
                name: student.name,
                currentScore: student.points,
                stage: {
                    name: stageInfo.description,
                    description: stageInfo.description,
                    image: `./images/phase${getStageNumber(student.stage)}.jpg`
                }
            };
        });

        res.json({ students: rankedStudents });
    });
});

// 辅助函数：根据stage获取阶段信息
function getStageInfo(stageName) {
    const stages = {
        'level1': { description: '第1級' },
        'level2': { description: '第2級' },
        'level3': { description: '第3級' },
        'level4': { description: '第4級' },
        'level5': { description: '第5級' },
        'level6': { description: '第6級' },
        'level7': { description: '第7級' },
        'level8': { description: '第8級' },
        'level9': { description: '第9級' },
        'level10': { description: '第10級' }
    };
    return stages[stageName] || { description: '第1級' };
}

// 辅助函数：根据stage获取阶段编号
function getStageNumber(stageName) {
    const match = stageName.match(/level(\d+)/);
    return match ? match[1] : '1';
}

// ============ 自定義行為管理 API ============

// ============ 自定義階段和行為管理 API ============

// 獲取自定義階段配置
apiRouter.get('/stages/custom', (req, res) => {
    database.getCustomStages((err, stages) => {
        if (err) {
            return res.status(500).json({ error: '獲取階段配置失敗' });
        }
        
        // 轉換為前端期望的格式
        const result = stages.map(stage => ({
            name: stage.name,
            min: stage.min_points,
            max: stage.max_points,
            description: stage.description,
            image: stage.image
        }));
        
        res.json(result);
    });
});

// 保存自定義階段配置
apiRouter.post('/stages/custom', requireTeacherAuth, (req, res) => {
    const { stages } = req.body;
    
    if (!Array.isArray(stages)) {
        return res.status(400).json({ error: '無效的階段配置資料' });
    }
    
    console.log(`💾 保存自定義階段配置:`, stages);
    
    database.saveCustomStages(stages, (err) => {
        if (err) {
            console.error('❌ 保存階段配置失敗:', err);
            return res.status(500).json({ error: '保存階段配置失敗' });
        }
        console.log('✅ 階段配置保存成功');
        res.json({ message: '階段配置保存成功' });
    });
});

// 獲取自定義行為配置
apiRouter.get('/behaviors', (req, res) => {
    database.getCustomBehaviors((err, behaviors) => {
        if (err) {
            return res.status(500).json({ error: '獲取行為配置失敗' });
        }
        
        // 將資料庫格式轉換為前端期望的格式
        const result = {
            positive: behaviors.filter(b => b.behavior_type === 'positive'),
            negative: behaviors.filter(b => b.behavior_type === 'negative'),
            supermarket: behaviors.filter(b => b.behavior_type === 'supermarket')
        };
        
        res.json(result);
    });
});

// 保存自定義行為配置
apiRouter.post('/behaviors', requireTeacherAuth, (req, res) => {
    const { behaviors } = req.body;
    
    if (!behaviors || typeof behaviors !== 'object') {
        return res.status(400).json({ error: '無效的行為配置資料' });
    }
    
    console.log(`💾 保存自定義行為配置:`, behaviors);
    
    database.saveCustomBehaviors(behaviors, (err) => {
        if (err) {
            console.error('❌ 保存行為配置失敗:', err);
            return res.status(500).json({ error: '保存行為配置失敗' });
        }
        console.log('✅ 行為配置保存成功');
        res.json({ message: '行為配置保存成功' });
    });
});

// ============ 備份 API 端點 ============
const backup = require('./backup');

// 備份狀態查詢
apiRouter.get('/backup/status', (req, res) => {
    const fs = require('fs');
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
        return res.json({
            status: 'no_backups',
            message: '尚未進行任何備份',
            backupCount: 0
        });
    }
    
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(f => f.endsWith('.db'));
    
    res.json({
        status: 'active',
        backupCount: backupFiles.length,
        lastBackup: backupFiles.length > 0 ? backupFiles[backupFiles.length - 1] : null,
        backupFiles: backupFiles.slice(-5) // 最近5個備份
    });
});

// 觸發手動備份
apiRouter.post('/backup/trigger', requireTeacherAuth, (req, res) => {
    const { type = 'local', includeEmail = false } = req.body;
    
    console.log(`🔄 手動觸發備份 - 類型: ${type}, 郵件: ${includeEmail}`);
    
    const backupType = includeEmail ? 'email' : type;
    
    backup.performBackup(backupType, (err, result) => {
        if (err) {
            console.error('❌ 手動備份失敗:', err);
            return res.status(500).json({
                success: false,
                message: '備份失敗',
                error: err.message
            });
        }
        
        res.json({
            success: true,
            message: '備份成功完成',
            type: backupType,
            result,
            timestamp: new Date().toISOString()
        });
    });
});

// 郵件備份專用端點
apiRouter.post('/backup/email', requireTeacherAuth, (req, res) => {
    console.log('📧 觸發郵件備份');
    
    backup.performBackup('email', (err, result) => {
        if (err) {
            console.error('❌ 郵件備份失敗:', err);
            return res.status(500).json({
                success: false,
                message: '郵件備份失敗',
                error: err.message
            });
        }
        
        res.json({
            success: true,
            message: '郵件備份成功完成',
            result,
            timestamp: new Date().toISOString()
        });
    });
});

// 備份記錄查詢
apiRouter.get('/backup/logs', (req, res) => {
    const fs = require('fs');
    const logPath = path.join(__dirname, 'backup.log');
    
    if (!fs.existsSync(logPath)) {
        return res.json({
            logs: [],
            message: '暫無備份記錄'
        });
    }
    
    try {
        const logContent = fs.readFileSync(logPath, 'utf8');
        const logs = logContent.split('\n').filter(line => line.trim()).slice(-20); // 最近20條記錄
        
        res.json({
            logs,
            count: logs.length
        });
    } catch (error) {
        res.status(500).json({
            error: '讀取備份記錄失敗',
            message: error.message
        });
    }
});

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 掛載API路由器（支援子文件夾部署）
if (BASE_PATH) {
    app.use(`${BASE_PATH}/api`, apiRouter);
    console.log(`🔗 API路由將在 ${BASE_PATH}/api 路徑下提供服務`);
} else {
    app.use('/api', apiRouter);
}

// ============ 定時備份功能 ============
function setupBackupSchedule() {
    // 檢查是否啟用自動備份
    const autoBackupEnabled = process.env.AUTO_BACKUP_ENABLED !== 'false';
    
    if (!autoBackupEnabled) {
        console.log('⚠️  自動備份已禁用');
        return;
    }
    
    // 設置備份時間 - 默認每 4 小時備份一次
    const backupSchedule = process.env.BACKUP_CRON_SCHEDULE || '0 */4 * * *';
    
    console.log(`📅 設置定時備份: ${backupSchedule} (${process.env.TZ || 'Asia/Hong_Kong'})`);
    
    cron.schedule(backupSchedule, async () => {
        console.log('🕐 定時備份任務觸發 -', new Date().toLocaleString('zh-TW'));
        
        try {
            const backup = require('./backup');
            
            // 執行郵件備份
            backup.performBackup('email', (err, result) => {
                if (err) {
                    console.error('❌ 定時備份失敗:', err.message);
                } else {
                    console.log('✅ 定時備份成功完成:', result);
                }
            });
            
        } catch (error) {
            console.error('❌ 定時備份執行錯誤:', error.message);
        }
    }, {
        timezone: process.env.TZ || "Asia/Hong_Kong"
    });
    
    console.log('✅ 定時備份已設置');
}

// ============ 飢餓系統定時檢查 ============
function setupHungerCheck() {
    // 每天早上8點檢查飢餓狀態
    const hungerCheckSchedule = process.env.HUNGER_CHECK_SCHEDULE || '0 8 * * *';
    
    console.log(`🍽️ 設置飢餓檢查: ${hungerCheckSchedule} (${process.env.TZ || 'Asia/Hong_Kong'})`);
    
    cron.schedule(hungerCheckSchedule, async () => {
        console.log('🍽️ 飢餓檢查任務觸發 -', new Date().toLocaleString('zh-TW'));
        
        try {
            database.processAllHungryStudents((err, results) => {
                if (err) {
                    console.error('❌ 飢餓檢查失敗:', err.message);
                } else if (results.length > 0) {
                    console.log(`😵 處理了 ${results.length} 位飢餓學生的降級:`);
                    results.forEach(result => {
                        console.log(`  - ${result.studentName}: ${result.oldStage}(${result.oldPoints}分) → ${result.newStage}(${result.newPoints}分)`);
                    });
                } else {
                    console.log('✅ 沒有學生需要飢餓降級');
                }
            });
            
        } catch (error) {
            console.error('❌ 飢餓檢查執行錯誤:', error.message);
        }
    }, {
        timezone: process.env.TZ || "Asia/Hong_Kong"
    });
    
    console.log('✅ 飢餓檢查已設置');
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 班房管理系统运行在 http://localhost:${PORT}`);
    if (BASE_PATH) {
        console.log(`📁 部署路徑: ${BASE_PATH}`);
    }
    console.log('📚 数据库已初始化');
    console.log('🎮 养成游戏系统已就绪！');
    
    // 設置定時備份
    setupBackupSchedule();
    
    // 設置飢餓檢查
    setupHungerCheck();
});

module.exports = app;
