const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 載入環境變量
require('dotenv').config();

// 数据库文件路径 - 支持環境變量配置
const dbPath = process.env.DB_PATH || path.join(__dirname, 'classroom.db');

// 確保數據庫目錄存在
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
function initializeDatabase() {
    db.serialize(() => {
        // 学生表
        db.run(`CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            wallet_points INTEGER DEFAULT 0,
            stage TEXT DEFAULT 'egg',
            character_type TEXT DEFAULT 'default',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 添加wallet_points列（如果不存在）
        db.run(`ALTER TABLE students ADD COLUMN wallet_points INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('添加wallet_points字段失败:', err);
            }
        });

        // 飢餓系統相關字段初始化已移除

        // 积分记录表
        db.run(`CREATE TABLE IF NOT EXISTS point_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            points_change INTEGER,
            reason TEXT,
            created_by TEXT DEFAULT 'teacher',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id)
        )`);

        // 超級市場購買記錄表
        db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            item_name TEXT NOT NULL,
            item_icon TEXT,
            cost INTEGER NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )`);

        // 角色进化配置表
        db.run(`CREATE TABLE IF NOT EXISTS evolution_config (
            id INTEGER PRIMARY KEY,
            stage TEXT NOT NULL,
            min_points INTEGER NOT NULL,
            max_points INTEGER,
            description TEXT
        )`);

        // 插入默认的10级进化配置 (每20分一级)
        db.run(`INSERT OR REPLACE INTO evolution_config (id, stage, min_points, max_points, description) VALUES
            (1, 'level1', 0, 19, '第1級 - 初始階段'),
            (2, 'level2', 20, 39, '第2級 - 開始成長'),
            (3, 'level3', 40, 59, '第3級 - 持續進步'),
            (4, 'level4', 60, 79, '第4級 - 穩定發展'),
            (5, 'level5', 80, 99, '第5級 - 加速成長'),
            (6, 'level6', 100, 129, '第6級 - 突破自我'),
            (7, 'level7', 130, 159, '第7級 - 優秀表現'),
            (8, 'level8', 160, 189, '第8級 - 卓越水準'),
            (9, 'level9', 190, 219, '第9級 - 接近完美'),
            (10, 'level10', 220, 999999, '第10級 - 完美境界')
        `);

        // 自定義階段配置表
        db.run(`CREATE TABLE IF NOT EXISTS custom_stages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stage_key TEXT NOT NULL,
            name TEXT NOT NULL,
            min_points INTEGER NOT NULL,
            max_points INTEGER NOT NULL,
            description TEXT,
            image TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 自定義行為配置表
        db.run(`CREATE TABLE IF NOT EXISTS custom_behaviors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            behavior_type TEXT NOT NULL CHECK (behavior_type IN ('positive', 'negative', 'supermarket')),
            icon TEXT NOT NULL,
            name TEXT NOT NULL,
            points INTEGER NOT NULL,
            description TEXT,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY,
            config_key TEXT UNIQUE NOT NULL,
            config_value TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 插入默認的老師密碼
        db.run(`INSERT OR REPLACE INTO system_config (id, config_key, config_value, description) VALUES
            (1, 'teacher_password', '28915063', '老師登入密碼')
        `);

        console.log('数据库初始化完成');
    });
}

// 获取所有学生
function getAllStudents(callback) {
    db.all("SELECT * FROM students ORDER BY points DESC, name ASC", callback);
}

// 添加学生
function addStudent(name, callback) {
    db.run("INSERT INTO students (name) VALUES (?)", [name], callback);
}

// 更新学生积分和阶段
function updateStudentPoints(studentId, pointsChange, reason, callback) {
    db.get("SELECT points FROM students WHERE id = ?", [studentId], (err, row) => {
        if (err) return callback(err);
        
        const newPoints = Math.max(0, row.points + pointsChange);
        const newStage = getStageByPoints(newPoints);
        
        db.run(
            "UPDATE students SET points = ?, stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [newPoints, newStage, studentId],
            function(updateErr) {
                if (updateErr) return callback(updateErr);
                
                // 记录积分变化
                db.run(
                    "INSERT INTO point_logs (student_id, points_change, reason) VALUES (?, ?, ?)",
                    [studentId, pointsChange, reason],
                    callback
                );
            }
        );
    });
}

// 全班加减分
function updateAllStudentsPoints(pointsChange, reason, callback) {
    db.all("SELECT id, points FROM students", (err, students) => {
        if (err) return callback(err);
        
        let completed = 0;
        const total = students.length;
        
        if (total === 0) return callback(null);
        
        students.forEach(student => {
            const newPoints = Math.max(0, student.points + pointsChange);
            const newStage = getStageByPoints(newPoints);
            
            db.run(
                "UPDATE students SET points = ?, stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [newPoints, newStage, student.id],
                function(updateErr) {
                    if (updateErr) return callback(updateErr);
                    
                    // 记录积分变化
                    db.run(
                        "INSERT INTO point_logs (student_id, points_change, reason) VALUES (?, ?, ?)",
                        [student.id, pointsChange, reason],
                        function(logErr) {
                            if (logErr) return callback(logErr);
                            
                            completed++;
                            if (completed === total) {
                                callback(null);
                            }
                        }
                    );
                }
            );
        });
    });
}

// 根据积分确定阶段 (10级系统，每20分一级)
function getStageByPoints(points) {
    if (points < 20) return 'level1';      // 第1級 0-19
    if (points < 40) return 'level2';      // 第2級 20-39
    if (points < 60) return 'level3';      // 第3級 40-59
    if (points < 80) return 'level4';      // 第4級 60-79
    if (points < 100) return 'level5';     // 第5級 80-99
    if (points < 130) return 'level6';     // 第6級 100-129
    if (points < 160) return 'level7';     // 第7級 130-159
    if (points < 190) return 'level8';     // 第8級 160-189
    if (points < 220) return 'level9';     // 第9級 190-219
    return 'level10';                      // 第10級 220+
}

// 获取积分记录
function getPointLogs(studentId, callback) {
    const query = studentId 
        ? "SELECT pl.*, s.name FROM point_logs pl JOIN students s ON pl.student_id = s.id WHERE pl.student_id = ? ORDER BY pl.created_at DESC LIMIT 20"
        : "SELECT pl.*, s.name FROM point_logs pl JOIN students s ON pl.student_id = s.id ORDER BY pl.created_at DESC LIMIT 50";
    
    const params = studentId ? [studentId] : [];
    db.all(query, params, callback);
}

// 删除学生
function deleteStudent(studentId, callback) {
    db.run("DELETE FROM students WHERE id = ?", [studentId], callback);
}

// 獲取系統配置
function getSystemConfig(configKey, callback) {
    db.get("SELECT config_value FROM system_config WHERE config_key = ?", [configKey], callback);
}

// 更新系統配置
function updateSystemConfig(configKey, configValue, callback) {
    db.run(
        "UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?",
        [configValue, configKey],
        callback
    );
}

// 驗證老師密碼
function verifyTeacherPassword(inputPassword, callback) {
    getSystemConfig('teacher_password', (err, row) => {
        if (err) return callback(err, false);
        if (!row) return callback(new Error('未找到老師密碼配置'), false);
        
        const isValid = row.config_value === inputPassword;
        callback(null, isValid);
    });
}

// 更新學生錢包積分
function updateWalletPoints(studentId, points, callback) {
    db.run(
        "UPDATE students SET wallet_points = wallet_points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [points, studentId],
        callback
    );
}

// 購買商品（扣除錢包積分並記錄購買）
function purchaseItem(studentId, itemName, itemIcon, cost, description, callback) {
    db.serialize(() => {
        // 開始事務
        db.run("BEGIN TRANSACTION");
        
        // 檢查錢包餘額
        db.get("SELECT wallet_points FROM students WHERE id = ?", [studentId], (err, row) => {
            if (err) {
                db.run("ROLLBACK");
                return callback(err);
            }
            
            if (!row) {
                db.run("ROLLBACK");
                return callback(new Error('學生不存在'));
            }
            
            if (row.wallet_points < cost) {
                db.run("ROLLBACK");
                return callback(new Error('錢包積分不足'));
            }
            
            // 扣除錢包積分
            db.run(
                "UPDATE students SET wallet_points = wallet_points - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [cost, studentId],
                function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return callback(err);
                    }
                    
                    // 記錄購買
                    db.run(
                        "INSERT INTO purchases (student_id, item_name, item_icon, cost, description) VALUES (?, ?, ?, ?, ?)",
                        [studentId, itemName, itemIcon, cost, description],
                        function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return callback(err);
                            }
                            
                            // 提交事務
                            db.run("COMMIT", callback);
                        }
                    );
                }
            );
        });
    });
}

// 獲取學生購買記錄
function getPurchases(studentId, callback) {
    if (studentId) {
        db.all(
            "SELECT * FROM purchases WHERE student_id = ? ORDER BY created_at DESC",
            [studentId],
            callback
        );
    } else {
        db.all(
            "SELECT p.*, s.name as student_name FROM purchases p LEFT JOIN students s ON p.student_id = s.id ORDER BY p.created_at DESC",
            callback
        );
    }
}

// ============ 飢餓系統相關函數已移除 ============

// 獲取階段的起始分數
function getStageStartScore(stageName) {
    const stageRanges = {
        'level1': 0,    // 第1級: 0-19分
        'level2': 20,   // 第2級: 20-39分
        'level3': 40,   // 第3級: 40-59分
        'level4': 60,   // 第4級: 60-79分
        'level5': 80,   // 第5級: 80-99分
        'level6': 100,  // 第6級: 100-129分
        'level7': 130,  // 第7級: 130-159分
        'level8': 160,  // 第8級: 160-189分
        'level9': 190,  // 第9級: 190-219分
        'level10': 220  // 第10級: 220+分
    };
    
    return stageRanges[stageName] || 0;
}

// 獲取前一個階段
function getPreviousStage(currentStage) {
    const stageOrder = [
        'level1', 'level2', 'level3', 'level4', 'level5',
        'level6', 'level7', 'level8', 'level9', 'level10'
    ];
    
    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex > 0) {
        return stageOrder[currentIndex - 1];
    }
    return 'level1'; // 最低級別
}

// 飢餓降級處理函數已移除

// 重置所有學生分數和記錄
function resetAllStudentsData(callback) {
    db.serialize(() => {
        // 開始事務
        db.run("BEGIN TRANSACTION", (err) => {
            if (err) return callback(err);
            
            // 重置所有學生分數到0，階段到level1
            db.run(
                "UPDATE students SET points = 0, stage = 'level1', wallet_points = 0, updated_at = CURRENT_TIMESTAMP", 
                function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return callback(err);
                    }
                    
                    // 清空積分記錄
                    db.run("DELETE FROM point_logs", function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return callback(err);
                        }
                        
                        // 清空購買記錄
                        db.run("DELETE FROM purchases", function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return callback(err);
                            }
                            
                            // 提交事務
                            db.run("COMMIT", function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return callback(err);
                                }
                                
                                console.log('✅ 所有學生資料已重置');
                                callback(null, { message: '所有學生資料已重置' });
                            });
                        });
                    });
                }
            );
        });
    });
}

// ============ 自定義階段管理 ============

// 獲取所有自定義階段
function getCustomStages(callback) {
    db.all(
        "SELECT * FROM custom_stages ORDER BY display_order, min_points",
        callback
    );
}

// 保存自定義階段（完全替換）
function saveCustomStages(stagesData, callback) {
    if (!Array.isArray(stagesData)) {
        return callback(new Error('階段資料必須是陣列'));
    }
    
    db.serialize(() => {
        // 開始事務
        db.run("BEGIN TRANSACTION", (err) => {
            if (err) return callback(err);
            
            // 清空現有階段
            db.run("DELETE FROM custom_stages", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return callback(err);
                }
                
                if (stagesData.length === 0) {
                    // 沒有階段要插入，直接提交
                    db.run("COMMIT", callback);
                    return;
                }
                
                let completed = 0;
                const total = stagesData.length;
                
                // 插入階段
                stagesData.forEach((stage, index) => {
                    db.run(
                        "INSERT INTO custom_stages (stage_key, name, min_points, max_points, description, image, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [stage.name, stage.name, stage.min, stage.max, stage.description || '', stage.image, index],
                        function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return callback(err);
                            }
                            
                            completed++;
                            if (completed === total) {
                                db.run("COMMIT", callback);
                            }
                        }
                    );
                });
            });
        });
    });
}

// ============ 自定義行為管理 ============

// 獲取所有自定義行為
function getCustomBehaviors(callback) {
    db.all(
        "SELECT * FROM custom_behaviors ORDER BY behavior_type, display_order, created_at",
        callback
    );
}

// 保存自定義行為（完全替換）
function saveCustomBehaviors(behaviorsData, callback) {
    db.serialize(() => {
        // 開始事務
        db.run("BEGIN TRANSACTION", (err) => {
            if (err) return callback(err);
            
            // 清空現有行為
            db.run("DELETE FROM custom_behaviors", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return callback(err);
                }
                
                // 插入新行為
                let completed = 0;
                let totalInserts = 0;
                
                // 計算總插入數量
                if (behaviorsData.positive) totalInserts += behaviorsData.positive.length;
                if (behaviorsData.negative) totalInserts += behaviorsData.negative.length;
                if (behaviorsData.supermarket) totalInserts += behaviorsData.supermarket.length;
                
                if (totalInserts === 0) {
                    // 沒有行為要插入，直接提交
                    db.run("COMMIT", callback);
                    return;
                }
                
                // 插入正面行為
                if (behaviorsData.positive) {
                    behaviorsData.positive.forEach((behavior, index) => {
                        db.run(
                            "INSERT INTO custom_behaviors (behavior_type, icon, name, points, description, display_order) VALUES (?, ?, ?, ?, ?, ?)",
                            ['positive', behavior.icon, behavior.name, behavior.points, behavior.description || '', index],
                            function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return callback(err);
                                }
                                
                                completed++;
                                if (completed === totalInserts) {
                                    db.run("COMMIT", callback);
                                }
                            }
                        );
                    });
                }
                
                // 插入負面行為
                if (behaviorsData.negative) {
                    behaviorsData.negative.forEach((behavior, index) => {
                        db.run(
                            "INSERT INTO custom_behaviors (behavior_type, icon, name, points, description, display_order) VALUES (?, ?, ?, ?, ?, ?)",
                            ['negative', behavior.icon, behavior.name, behavior.points, behavior.description || '', index],
                            function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return callback(err);
                                }
                                
                                completed++;
                                if (completed === totalInserts) {
                                    db.run("COMMIT", callback);
                                }
                            }
                        );
                    });
                }
                
                // 插入超級市場行為
                if (behaviorsData.supermarket) {
                    behaviorsData.supermarket.forEach((behavior, index) => {
                        db.run(
                            "INSERT INTO custom_behaviors (behavior_type, icon, name, points, description, display_order) VALUES (?, ?, ?, ?, ?, ?)",
                            ['supermarket', behavior.icon, behavior.name, behavior.points, behavior.description || '', index],
                            function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return callback(err);
                                }
                                
                                completed++;
                                if (completed === totalInserts) {
                                    db.run("COMMIT", callback);
                                }
                            }
                        );
                    });
                }
            });
        });
    });
}

module.exports = {
    db,
    initializeDatabase,
    getAllStudents,
    addStudent,
    updateStudentPoints,
    updateAllStudentsPoints,
    getPointLogs,
    deleteStudent,
    getStageByPoints,
    getSystemConfig,
    updateSystemConfig,
    verifyTeacherPassword,
    updateWalletPoints,
    purchaseItem,
    getPurchases,
    // 飢餓系統函數導出已移除
    resetAllStudentsData,
    getCustomStages,
    saveCustomStages,
    getCustomBehaviors,
    saveCustomBehaviors
};
