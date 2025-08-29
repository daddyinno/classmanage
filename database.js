const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'classroom.db');

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
            (6, 'level6', 100, 119, '第6級 - 突破自我'),
            (7, 'level7', 120, 139, '第7級 - 優秀表現'),
            (8, 'level8', 140, 159, '第8級 - 卓越水準'),
            (9, 'level9', 160, 179, '第9級 - 接近完美'),
            (10, 'level10', 180, 999999, '第10級 - 完美境界')
        `);

        // 系統配置表
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
    if (points < 120) return 'level6';     // 第6級 100-119
    if (points < 140) return 'level7';     // 第7級 120-139
    if (points < 160) return 'level8';     // 第8級 140-159
    if (points < 180) return 'level9';     // 第9級 160-179
    return 'level10';                      // 第10級 180+
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
    verifyTeacherPassword
};
