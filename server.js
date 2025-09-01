const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const database = require('./database');

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
    
    // 如果有特定的老師模式標頭，允許通過
    if (authHeader === 'true') {
        next();
    } else {
        res.status(403).json({ 
            error: '需要老師權限', 
            message: '此操作需要老師權限才能執行' 
        });
    }
}

// 初始化数据库
database.initializeDatabase();

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
    
    database.updateStudentPoints(studentId, points, reason || '手动调整', (err) => {
        if (err) {
            return res.status(500).json({ error: '更新积分失败' });
        }
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

// 購買商品
apiRouter.post('/students/:id/purchase', (req, res) => {
    const studentId = parseInt(req.params.id);
    const { itemName, itemIcon, cost, description } = req.body;
    
    if (isNaN(studentId) || !itemName || isNaN(cost)) {
        return res.status(400).json({ error: '無效的參數' });
    }
    
    database.purchaseItem(studentId, itemName, itemIcon, cost, description, (err) => {
        if (err) {
            if (err.message === '錢包積分不足') {
                return res.status(400).json({ error: '錢包積分不足' });
            }
            return res.status(500).json({ error: '購買失敗' });
        }
        res.json({ message: '購買成功' });
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

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 班房管理系统运行在 http://localhost:${PORT}`);
    if (BASE_PATH) {
        console.log(`📁 部署路徑: ${BASE_PATH}`);
    }
    console.log('📚 数据库已初始化');
    console.log('🎮 养成游戏系统已就绪！');
});

module.exports = app;
