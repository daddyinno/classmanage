// 全局變量
let students = [];
let logs = [];
let selectedStudents = [];
let selectedBehavior = null;
let isSelectionMode = false;
let isPurchaseMode = false;
let isEditMode = false;
let editingBehaviorIndex = -1;
let editingBehaviorType = '';
let customBehaviors = null;
let currentTimeFilter = 'week';
let rankingData = null;
let isStageEditMode = false;
let editingStageIndex = -1;
let customStages = null;
let isTeacherMode = false; // 老師模式狀態

// 階段配置（已廢棄，使用 getCurrentStageConfig() 替代）

// API 基礎URL - 支援子文件夾部署
const API_BASE = (() => {
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;
    const currentPath = window.location.pathname;
    
    // 如果是本地开发环境
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        return `http://${currentHost}:${currentPort || 3000}/api`;
    }
    
    // 生产环境：基于当前路径构建API路径
    // 例如：如果页面是 /subfolder/index.html，API应该是 /subfolder/api
    // 如果页面在 /subfolder/public/index.html，API应该是 /subfolder/api
    let basePath = currentPath.replace(/\/[^\/]*$/, ''); // 去掉文件名，保留路径
    
    // 如果路径包含 /public，则移除它（因为API在上一级目录）
    if (basePath.endsWith('/public')) {
        basePath = basePath.replace('/public', '');
    }
    
    const apiPath = basePath + '/api';
    
    console.log('部署环境检测:', {
        currentPath,
        basePath,
        apiPath,
        finalAPI: apiPath
    });
    
    return apiPath;
})();

// 頁面載入完成後執行
document.addEventListener('DOMContentLoaded', function() {
    loadCustomBehaviors();
    loadStudents();
    loadLogs();
    renderBehaviorOptions();
    
    // 初始化為學生模式（隱藏所有編輯功能）
    hideAllEditFeatures();
    
    // 確保學生選擇面板在初始化時就隱藏
    const selectedStudentsPanel = document.getElementById('selectedStudentsPanel');
    if (selectedStudentsPanel) {
        selectedStudentsPanel.style.display = 'none';
        selectedStudentsPanel.style.visibility = 'hidden';
    }
    
    // 確保所有操作按鈕在初始化時就隱藏
    const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
    quickSelectBtns.forEach(btn => {
        if (btn) {
            btn.style.display = 'none';
            btn.style.visibility = 'hidden';
        }
    });
    
    const applyBtn = document.getElementById('applyBehaviorBtn');
    if (applyBtn) {
        applyBtn.style.display = 'none';
        applyBtn.style.visibility = 'hidden';
    }
    
    // 回車鍵新增學生
    const studentNameInput = document.getElementById('studentName');
    if (studentNameInput) {
        studentNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addStudent();
            }
        });
    }
});

// 載入學生列表
async function loadStudents() {
    try {
        const response = await fetch(`${API_BASE}/students`);
        const data = await response.json();
        
        if (response.ok) {
            students = data;
            renderStudents();
            renderStages(); // 渲染進化階段
        } else {
            showError('載入學生列表失敗: ' + data.error);
        }
    } catch (error) {
        showError('網路錯誤: ' + error.message);
    }
}

// 渲染學生列表
function renderStudents() {
    const container = document.getElementById('studentsContainer');
    const countElement = document.getElementById('studentCount');
    
    countElement.textContent = students.length;
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-emoji">👨‍🎓</span>
                <h3>還沒有學生</h3>
                <p>點擊上方「新增學生」按鈕開始吧！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = students.map(student => createStudentCard(student)).join('');
}

// 防抖變量
let toggleTimeout = null;

// 建立學生卡片
function createStudentCard(student) {
    const stage = getStageByPoints(student.points);
    const progress = calculateProgress(student.points, stage);
    const isSelected = selectedStudents.some(s => s.id === student.id);
    const selectableClass = isSelectionMode ? 'selectable' : '';
    const selectedClass = isSelected ? 'selected-for-behavior' : '';
    const clickHandler = (isSelectionMode && isTeacherMode) ? `handleStudentSelection(${student.id}, event)` : '';
    
    return `
        <div class="student-card ${selectableClass} ${selectedClass}" data-student-id="${student.id}" ${(isSelectionMode && isTeacherMode) ? `onclick="${clickHandler}"` : ''}>
            ${isTeacherMode ? `<button class="delete-btn btn-danger" onclick="event.stopPropagation(); deleteStudent(${student.id})" title="刪除學生">
                ✕
            </button>` : ''}
            
            <div class="selection-indicator">${isSelected ? '✓' : ''}</div>
            
            <!-- 學生頭像 -->
            <div class="student-avatar-section">
                <div class="student-photo-placeholder" data-student-id="${student.id}">
                    <img src="${stage.image}" alt="${stage.name}" class="student-avatar-image" />
                </div>
            </div>
            
            <!-- 學生姓名 -->
            <div class="student-name">
                <h4>${escapeHtml(student.name)}</h4>
            </div>
            
            <!-- 學生階段 -->
            <div class="student-stage">${stage.name}</div>
            
                         <!-- 學生分數 -->
             <div class="student-points-container">
                 <div class="total-points-display">
                     <span class="points-label">總積分</span>
                     <span class="points-value">${student.points}</span>
                 </div>
             </div>
             
             <!-- 進度信息 -->
             <div class="progress-info">
                 <small>${getProgressText(student.points, stage)}</small>
             </div>
            

            

        </div>
    `;
}



// 计算进度
function calculateProgress(points, stage) {
    if (!stage) return 0;
    
    const progress = ((points - stage.min) / (stage.max - stage.min)) * 100;
    return Math.min(100, Math.max(0, progress));
}

// 获取进度文本
function getProgressText(points, stageInfo) {
    if (!stageInfo) return '';
    
    const stages = getCurrentStageConfig();
    const currentStageIndex = stages.findIndex(s => 
        points >= s.min && points <= s.max
    );
    
    if (currentStageIndex === -1) return '';
    
    // 如果是最高階段
    if (currentStageIndex === stages.length - 1 || stageInfo.max === 999999) {
        return '已達到最高階段！';
    }
    
    const nextStage = stages[currentStageIndex + 1];
    const pointsNeeded = nextStage.min - points;
    
    if (pointsNeeded <= 0) {
        return `可以進化到 ${nextStage.name}！`;
    }
    
    return `距離 ${nextStage.name} 還需 ${pointsNeeded} 分`;
}

// 添加学生
async function addStudent() {
    // 安全檢查：學生模式下禁止添加學生
    if (!isTeacherMode) {
        console.warn('安全提示：學生模式下無法添加學生');
        showError('需要老師權限才能進行此操作');
        return;
    }
    
    const nameInput = document.getElementById('studentName');
    const name = nameInput.value.trim();
    
    if (!name) {
        showError('請輸入學生姓名');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Teacher-Mode': isTeacherMode ? 'true' : 'false'
            },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            nameInput.value = '';
            showSuccess('學生新增成功！');
            loadStudents();
        } else {
            showError('新增失敗: ' + data.error);
        }
    } catch (error) {
        showError('網路錯誤: ' + error.message);
    }
}



// 带动画效果的积分调整
async function adjustPointsWithAnimation(studentId, points, reason) {
    // 安全檢查：學生模式下禁止任何數據修改
    if (!isTeacherMode) {
        console.warn('安全提示：學生模式下無法修改數據');
        showError('需要老師權限才能進行此操作');
        return;
    }
    
    const student = students.find(s => s.id === studentId);
    const oldStage = student ? student.stage : 'egg';
    
    try {
        const response = await fetch(`${API_BASE}/students/${studentId}/points`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Teacher-Mode': isTeacherMode ? 'true' : 'false'
            },
            body: JSON.stringify({ 
                points: points,
                reason: reason
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {

            
            // 显示积分变化动画
            showPointsAnimation(studentId, points);
            
            // 如果是大量加分，显示特殊庆祝效果
            if (points >= 10) {
                showSpecialCelebration(studentId, points);
            }
            
            // 重新加载数据
            await loadStudents();
            loadLogs();
            
            // 检查是否升级或降级
            const updatedStudent = students.find(s => s.id === studentId);
            if (updatedStudent && updatedStudent.stage !== oldStage) {
                // 获取旧的和新的阶段信息
                const oldStageInfo = getStageInfoByName(oldStage);
                const newStageInfo = getStageInfoByName(updatedStudent.stage);
                
                // 調試信息
                console.log('階段變化檢測:', {
                    studentName: updatedStudent.name,
                    oldStage: oldStage,
                    newStage: updatedStudent.stage,
                    oldStageInfo: oldStageInfo,
                    newStageInfo: newStageInfo,
                    pointsChange: points
                });
                
                // 確保階段信息有效
                if (oldStageInfo && newStageInfo && 
                    typeof oldStageInfo.min === 'number' && 
                    typeof newStageInfo.min === 'number') {
                    
                    // 判断是升级还是降级
                    const isUpgrade = isStageUpgrade(oldStageInfo, newStageInfo);
                    
                    console.log('升級判斷:', {
                        isUpgrade: isUpgrade,
                        oldMin: oldStageInfo.min,
                        newMin: newStageInfo.min,
                        comparison: `${newStageInfo.min} > ${oldStageInfo.min} = ${newStageInfo.min > oldStageInfo.min}`
                    });
                    
                    if (isUpgrade) {
                        showEvolutionAnimation(updatedStudent, oldStageInfo, newStageInfo);
                    } else {
                        showDowngradeAnimation(updatedStudent, oldStageInfo, newStageInfo);
                    }
                } else {
                    console.error('階段信息無效:', { oldStageInfo, newStageInfo });
                    // 備用：簡單的成功提示
                    showSuccess(`🎉 ${updatedStudent.name} 階段變化！現在是 ${updatedStudent.stage}！`);
                }
            } else if (points > 0) {
                // 沒有升級但加分時的鼓勵消息
                showSuccess(`🎉 ${updatedStudent.name} ${points > 0 ? '獲得' : '失去'} ${Math.abs(points)} 分！太棒了！`);
            } else {
                // 扣分時的鼓勵消息
                showError(`😔 ${updatedStudent.name} ${points > 0 ? '獲得' : '失去'} ${Math.abs(points)} 分，下次加油！`);
            }
        } else {
            showError('積分調整失敗: ' + data.error);
        }
    } catch (error) {
        showError('網路錯誤: ' + error.message);
    }
}

// 显示特殊庆祝效果
function showSpecialCelebration(studentId, points) {
    // 创建全屏烟花效果
    const fireworksContainer = document.createElement('div');
    fireworksContainer.className = 'fireworks-container';
    fireworksContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    
    document.body.appendChild(fireworksContainer);
    
    // 创建多个烟花
    for (let i = 0; i < 6; i++) {
        setTimeout(() => {
            createFirework(fireworksContainer);
        }, i * 300);
    }
    
    // 3秒后移除
    setTimeout(() => {
        if (fireworksContainer.parentNode) {
            fireworksContainer.parentNode.removeChild(fireworksContainer);
        }
    }, 3000);
}

// 创建烟花效果
function createFirework(container) {
    const firework = document.createElement('div');
    firework.className = 'firework';
    
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight * 0.6 + window.innerHeight * 0.2;
    
    firework.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 4px;
        height: 4px;
        background: #fff;
        border-radius: 50%;
        animation: fireworkExplode 1.5s ease-out forwards;
    `;
    
    // 创建爆炸粒子
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        
        const angle = (i * 30) * Math.PI / 180;
        const velocity = 50 + Math.random() * 50;
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particle.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 3px;
            height: 3px;
            background: ${color};
            border-radius: 50%;
            animation: fireworkParticle 1.2s ease-out forwards;
            --angle: ${angle};
            --velocity: ${velocity}px;
        `;
        
        container.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 1200);
    }
    
    container.appendChild(firework);
    
    setTimeout(() => {
        if (firework.parentNode) {
            firework.parentNode.removeChild(firework);
        }
    }, 1500);
}



// 调整单个学生积分（保留原函数用于兼容性）
async function adjustPoints(studentId, points) {
    await adjustPointsWithAnimation(studentId, points, `${points > 0 ? '加' : '减'}${Math.abs(points)}分`);
}

// 全班加减分
async function adjustAllPoints(points) {
    // 安全檢查：學生模式下禁止全班操作
    if (!isTeacherMode) {
        console.warn('安全提示：學生模式下無法進行全班操作');
        showError('需要老師權限才能進行此操作');
        return;
    }
    
    const action = points > 0 ? '加' : '减';
    const confirmMsg = `确定要给全班同学${action}${Math.abs(points)}分吗？`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/students/all/points`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Teacher-Mode': isTeacherMode ? 'true' : 'false'
            },
            body: JSON.stringify({ 
                points: points,
                reason: `全班${action}${Math.abs(points)}分`
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadStudents();
            loadLogs();
            showSuccess(`全班积分${action === '加' ? '增加' : '减少'}成功！`);
        } else {
            showError('全班积分调整失败: ' + data.error);
        }
    } catch (error) {
        showError('網路錯誤: ' + error.message);
    }
}

// 删除学生
async function deleteStudent(studentId) {
    // 安全檢查：學生模式下禁止刪除學生
    if (!isTeacherMode) {
        console.warn('安全提示：學生模式下無法刪除學生');
        showError('需要老師權限才能進行此操作');
        return;
    }
    
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    if (!confirm(`确定要删除学生 "${student.name}" 吗？此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/students/${studentId}`, {
            method: 'DELETE',
            headers: {
                'X-Teacher-Mode': isTeacherMode ? 'true' : 'false'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('学生删除成功！');
            loadStudents();
            loadLogs();
        } else {
            showError('删除失败: ' + data.error);
        }
    } catch (error) {
        showError('網路錯誤: ' + error.message);
    }
}

// 載入自定義行為
function loadCustomBehaviors() {
    const saved = localStorage.getItem('customBehaviors');
    if (saved) {
        customBehaviors = JSON.parse(saved);
    } else {
        customBehaviors = null;
    }
}

// 保存自定義行為
function saveCustomBehaviors() {
    localStorage.setItem('customBehaviors', JSON.stringify(customBehaviors));
}

// 獲取當前行為選項（自定義或預設）
function getCurrentBehaviorOptions() {
    return customBehaviors || BEHAVIOR_OPTIONS;
}

// 預設行為選項
const BEHAVIOR_OPTIONS = {
    positive: [
        { icon: '👍', name: '舉手發言', points: 1, description: 'hands up' },
        { icon: '❤️', name: '幫助他人', points: 1, description: 'helping others' },
        { icon: '🤫', name: '保持安靜', points: 1, description: 'keep quiet' },
        { icon: '💡', name: '積極參與', points: 1, description: 'participating' },
        { icon: '🏆', name: '努力學習', points: 1, description: 'working hard' },
        { icon: '✋', name: '回答問題', points: 1, description: 'answer questions' },
        { icon: '👌', name: '表現良好', points: 5, description: 'behave well' },
        { icon: '📋', name: '遵守規則', points: 1, description: 'follow the rules' },
        { icon: '✍️', name: '桌面整潔', points: 1, description: 'hands on the desk' },
        { icon: '📚', name: '作業優秀', points: 1, description: 'homework well-done' },
        { icon: '🧹', name: '保持清潔', points: 1, description: 'keep clean' },
        { icon: '🎯', name: '專注聽講', points: 1, description: 'listen to the teacher' },
        { icon: '🤝', name: '團隊合作', points: 2, description: 'teamwork' },
        { icon: '⏰', name: '準時到達', points: 1, description: 'on time' },
        { icon: '🎨', name: '創意表現', points: 2, description: 'creative work' },
        { icon: '💪', name: '堅持不懈', points: 2, description: 'persistence' }
    ],
    negative: [
        { icon: '🗣️', name: '大聲喧嘩', points: -1, description: 'talking loudly' },
        { icon: '😴', name: '上課睡覺', points: -2, description: 'sleeping in class' },
        { icon: '📱', name: '玩手機', points: -2, description: 'using phone' },
        { icon: '🏃', name: '隨意走動', points: -1, description: 'walking around' },
        { icon: '❌', name: '未交作業', points: -2, description: 'missing homework' },
        { icon: '🎮', name: '玩遊戲', points: -2, description: 'playing games' },
        { icon: '😡', name: '不禮貌', points: -3, description: 'being rude' },
        { icon: '⏰', name: '遲到', points: -1, description: 'late arrival' },
        { icon: '🗑️', name: '亂丟垃圾', points: -1, description: 'littering' },
        { icon: '💤', name: '注意力不集中', points: -1, description: 'not paying attention' }
    ],
    supermarket: [
        // 基本食物 (5分)
        { icon: '🍎', name: '紅蘋果', points: 5, description: '每日一蘋果，醫生遠離我' },
        { icon: '🍌', name: '香蕉', points: 5, description: '鉀質豐富，運動好夥伴' },
        { icon: '🍇', name: '葡萄', points: 5, description: '抗氧化維生素C' },
        { icon: '🥕', name: '胡蘿蔔', points: 5, description: '保護眼睛的β胡蘿蔔素' },
        { icon: '🥦', name: '花椰菜', points: 5, description: '超級蔬菜營養冠軍' },
        { icon: '🍞', name: '全麥麵包', points: 5, description: '纖維豐富的能量來源' },
        { icon: '🥛', name: '鮮奶', points: 5, description: '鈣質和蛋白質雙重補給' },
        { icon: '🧀', name: '起司', points: 5, description: '濃郁香醇的蛋白質' },
        { icon: '🥜', name: '綜合堅果', points: 5, description: '健腦好零食' },
        { icon: '💧', name: '純淨水', points: 5, description: '生命之源，最佳選擇' },
        { icon: '🍚', name: '糙米飯', points: 5, description: '營養完整的主食' },
        { icon: '🍅', name: '番茄', points: 5, description: '茄紅素抗氧化高手' },
        { icon: '🥗', name: '綜合沙拉', points: 5, description: '彩虹蔬菜營養滿分' },
        { icon: '🍦', name: '優格', points: 5, description: '益生菌健康選擇' },
        { icon: '🍵', name: '綠茶', points: 5, description: '抗氧化健康飲品' },
        
        // 獎勵食物 (10分)
        { icon: '🍯', name: '天然蜂蜜', points: 10, description: '大自然的甜蜜禮物' },
        { icon: '🍫', name: '黑巧克力', points: 10, description: '週末特殊獎勵' },
        { icon: '🧁', name: '生日蛋糕', points: 10, description: '超級慶祝獎勵' },
        { icon: '🍕', name: '瑪格麗特披薩', points: 10, description: '週末特殊獎勵' },
        { icon: '🍰', name: '水果蛋糕', points: 10, description: '特殊場合獎勵' }
    ]
};





// 加载积分记录
async function loadLogs() {
    try {
        const response = await fetch(`${API_BASE}/logs`);
        const data = await response.json();
        
        if (response.ok) {
            logs = data;
            updateStudentFilterOptions();
            renderLogs();
        } else {
            console.error('加载记录失败:', data.error);
        }
    } catch (error) {
        console.error('網路錯誤:', error.message);
    }
}

// 更新學生篩選選項
function updateStudentFilterOptions() {
    const studentFilter = document.getElementById('studentFilter');
    if (!studentFilter) return;
    
    // 獲取所有學生名稱（去重）
    const studentNames = [...new Set(logs.map(log => log.name))];
    
    // 清空現有選項（除了"所有學生"）
    studentFilter.innerHTML = '<option value="">所有學生</option>';
    
    // 添加學生選項
    studentNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        studentFilter.appendChild(option);
    });
}

// 渲染积分记录
function renderLogs() {
    const filteredLogs = getFilteredLogs();
    const container = document.getElementById('logsContainer');
    
    if (filteredLogs.length === 0) {
        container.innerHTML = '<div class="loading">暫無符合篩選條件的記錄</div>';
        return;
    }
    
    container.innerHTML = filteredLogs.map(log => createLogItem(log)).join('');
}

// 獲取篩選後的記錄
function getFilteredLogs() {
    let filteredLogs = [...logs];
    
    // 按學生篩選
    const studentFilter = document.getElementById('studentFilter');
    const selectedStudent = studentFilter ? studentFilter.value : '';
    if (selectedStudent) {
        filteredLogs = filteredLogs.filter(log => log.name === selectedStudent);
    }
    
    // 按時間範圍篩選
    const dateFilter = document.getElementById('dateFilter');
    const selectedDate = dateFilter ? dateFilter.value : '';
    if (selectedDate) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.created_at);
            switch (selectedDate) {
                case 'today':
                    return logDate >= startOfToday;
                case 'week':
                    return logDate >= startOfWeek;
                case 'month':
                    return logDate >= startOfMonth;
                default:
                    return true;
            }
        });
    }
    
    // 按操作類型篩選
    const typeFilter = document.getElementById('typeFilter');
    const selectedType = typeFilter ? typeFilter.value : '';
    if (selectedType) {
        filteredLogs = filteredLogs.filter(log => {
            if (selectedType === 'positive') {
                return log.points_change > 0;
            } else if (selectedType === 'negative') {
                return log.points_change < 0;
            }
            return true;
        });
    }
    
    return filteredLogs;
}

// 创建记录项
function createLogItem(log) {
    const isPositive = log.points_change > 0;
    const timeStr = new Date(log.created_at).toLocaleString('zh-CN');
    
    return `
        <div class="log-item ${isPositive ? 'positive' : 'negative'}">
            <div class="log-header">
                <span class="log-student">${escapeHtml(log.name)}</span>
                <span class="log-points ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${log.points_change}
                </span>
            </div>
            <div class="log-reason">${escapeHtml(log.reason || '无备注')}</div>
            <div class="log-time">${timeStr}</div>
        </div>
    `;
}

// 篩選記錄
function filterLogs() {
    renderLogs();
}

// 清除篩選條件
function clearFilters() {
    const studentFilter = document.getElementById('studentFilter');
    const dateFilter = document.getElementById('dateFilter');
    const typeFilter = document.getElementById('typeFilter');
    
    if (studentFilter) studentFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    
    renderLogs();
    showNotification('已清除所有篩選條件', 'info');
}

// 清空记录显示
function clearLogs() {
    document.getElementById('logsContainer').innerHTML = '<div class="loading">記錄已清空</div>';
}

// 关闭模态框
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
}

// 移除購買功能，超級市場現在直接使用加分功能

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '10px',
        color: 'white',
        fontWeight: '600',
        zIndex: '9999',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all 0.3s ease',
        maxWidth: '300px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
    });
    
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #f56565, #e53e3e)';
    }
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 100);
    
    // 自动消失
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 显示积分变化动画
function showPointsAnimation(studentId, points) {
    const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
    if (!studentCard) return;
    
    // 创建主要的积分变化动画
    const animationDiv = document.createElement('div');
    animationDiv.className = 'points-animation';
    
    // 根据积分正负显示不同的内容和动画
    if (points > 0) {
        animationDiv.innerHTML = `
            <div class="points-change positive">
                <div class="points-text">+${points}</div>
                <div class="praise-animation">
                    <span class="praise-emoji">👏</span>
                    <span class="praise-emoji">🎉</span>
                    <span class="praise-emoji">⭐</span>
                    <span class="praise-text">太棒了!</span>
                </div>
            </div>
        `;
        
        // 创建庆祝粒子效果
        createCelebrationParticles(studentCard);
        
        // 播放赞赏音效
        playPraiseSound();
        
    } else {
        animationDiv.innerHTML = `
            <div class="points-change negative">
                <div class="points-text">${points}</div>
                <div class="sad-animation">
                    <span class="sad-emoji">😢</span>
                    <span class="sad-emoji">💔</span>
                    <span class="sad-text">需要加油!</span>
                </div>
            </div>
        `;
        
        // 创建失望效果
        createSadEffect(studentCard);
        
        // 播放失望音效
        playSadSound();
    }
    
    // 设置动画样式
    Object.assign(animationDiv.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '1000',
        pointerEvents: 'none',
        fontSize: '20px',
        fontWeight: 'bold',
        textAlign: 'center',
        animation: points > 0 ? 'praiseAnimation 3s ease-out forwards' : 'sadAnimation 3s ease-out forwards'
    });
    
    studentCard.style.position = 'relative';
    studentCard.appendChild(animationDiv);
    
    // 移除动画元素
    setTimeout(() => {
        if (animationDiv.parentNode) {
            animationDiv.parentNode.removeChild(animationDiv);
        }
    }, 3000);
    
    // 卡片反馈效果
    if (points > 0) {
        studentCard.style.animation = 'cardPraiseEffect 1s ease-out';
        studentCard.style.boxShadow = '0 0 30px rgba(72, 187, 120, 0.6)';
    } else {
        studentCard.style.animation = 'cardSadEffect 1s ease-out';
        studentCard.style.boxShadow = '0 0 30px rgba(245, 101, 101, 0.6)';
    }
    
    setTimeout(() => {
        studentCard.style.animation = '';
        studentCard.style.boxShadow = '';
    }, 1000);
}

// 创建庆祝粒子效果
function createCelebrationParticles(container) {
    const particles = ['🌟', '⭐', '✨', '🎊', '🎉'];
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'celebration-particle';
        particle.textContent = particles[Math.floor(Math.random() * particles.length)];
        
        Object.assign(particle.style, {
            position: 'absolute',
            fontSize: '20px',
            pointerEvents: 'none',
            zIndex: '999',
            top: '50%',
            left: '50%',
            animation: `particleBurst 2s ease-out ${i * 0.1}s forwards`
        });
        
        container.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 2000);
    }
}

// 创建失望效果
function createSadEffect(container) {
    const sadElements = ['💧', '😿', '🌧️'];
    
    for (let i = 0; i < 5; i++) {
        const sadElement = document.createElement('div');
        sadElement.className = 'sad-particle';
        sadElement.textContent = sadElements[Math.floor(Math.random() * sadElements.length)];
        
        Object.assign(sadElement.style, {
            position: 'absolute',
            fontSize: '16px',
            pointerEvents: 'none',
            zIndex: '999',
            top: '30%',
            left: `${30 + i * 10}%`,
            animation: `sadFall 2.5s ease-in ${i * 0.2}s forwards`
        });
        
        container.appendChild(sadElement);
        
        setTimeout(() => {
            if (sadElement.parentNode) {
                sadElement.parentNode.removeChild(sadElement);
            }
        }, 2500);
    }
}

// 播放赞赏音效
function playPraiseSound() {
    try {
        // 创建一个简单的正面音效
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        // 忽略音频播放错误
    }
}

// 播放失望音效
function playSadSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        // 忽略音频播放错误
    }
}

// 根据阶段名称获取阶段信息
function getStageInfoByName(stageName) {
    const stages = getCurrentStageConfig();
    return stages.find(stage => {
        // 支持旧的命名方式 (egg, baby, character) 和新的命名方式 (level1, level2, ...)
        if (stageName === 'egg') return stage.min === 0;
        if (stageName === 'baby') return stage.min === 20 || stage.min === 50;
        if (stageName === 'character') return stage.min >= 200;
        
        // 新的level命名方式 - 直接比較階段名稱
        if (stageName && stage.name) {
            // 如果階段配置中使用的是 "第X級" 格式
            const stageNameMatch = stage.name.match(/第(\d+)級/);
            const inputLevelMatch = stageName.match(/level(\d+)/);
            
            if (stageNameMatch && inputLevelMatch) {
                const stageLevel = parseInt(stageNameMatch[1]);
                const inputLevel = parseInt(inputLevelMatch[1]);
                return stageLevel === inputLevel;
            }
        }
        
        // 後備方案：根據分數範圍匹配
        const levelMatch = stageName.match(/level(\d+)/);
        if (levelMatch) {
            const levelNum = parseInt(levelMatch[1]);
            // level1 = 0-19, level2 = 20-39, etc.
            const expectedMin = (levelNum - 1) * 20;
            return stage.min === expectedMin;
        }
        
        return false;
    }) || stages[0]; // 默认返回第一个阶段
}

// 判断是否为升级
function isStageUpgrade(oldStageInfo, newStageInfo) {
    return newStageInfo.min > oldStageInfo.min;
}

// 显示降级动画
function showDowngradeAnimation(student, oldStageInfo, newStageInfo) {
    // 创建全屏降级动画
    const downgradeOverlay = document.createElement('div');
    downgradeOverlay.className = 'downgrade-overlay';
    downgradeOverlay.innerHTML = `
        <div class="downgrade-content">
            <div class="downgrade-bg"></div>
            <div class="downgrade-text">
                <h1>😭 嗚，請繼續努力！</h1>
                <h2>${escapeHtml(student.name)} 等級下降了</h2>
                <div class="downgrade-stages">
                    <div class="stage-transition">
                        <img src="${oldStageInfo.image}" alt="${oldStageInfo.name}" class="old-stage downgrade-fade" />
                        <div class="arrow downgrade-arrow">⬇</div>
                        <img src="${newStageInfo.image}" alt="${newStageInfo.name}" class="new-stage downgrade-appear" />
                    </div>
                </div>
                <p class="downgrade-description">
                    現在是 <strong>${newStageInfo.name}</strong>，繼續努力！
                </p>
                <div class="encouragement-message">
                    <span class="sad-emoji cry-animation">😢</span>
                    <span class="encourage-text">加油！相信你可以重新升級！</span>
                    <span class="sad-emoji cry-animation">💧</span>
                </div>
                <div class="sad-rain-effect">
                    ${'💧'.repeat(15).split('').map((drop, i) => `<span class="rain-drop" style="animation-delay: ${i * 0.2}s; left: ${Math.random() * 100}%">${drop}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(downgradeOverlay);
    
    // 播放降級音效
    try {
        // 創建一個較低沉的音效
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1);
    } catch (e) {
        // 忽略音频播放错误
    }
    
    // 5秒后自动关闭
    setTimeout(() => {
        document.body.removeChild(downgradeOverlay);
    }, 5000);
    
    // 点击关闭
    downgradeOverlay.addEventListener('click', () => {
        if (downgradeOverlay.parentNode) {
            document.body.removeChild(downgradeOverlay);
        }
    });
}

// 显示进化动画
function showEvolutionAnimation(student, oldStage, newStage) {
    if (!newStage) {
        newStage = getStageByPoints(student.points);
    }
    
    // 创建全屏进化动画
    const evolutionOverlay = document.createElement('div');
    evolutionOverlay.className = 'evolution-overlay';
    evolutionOverlay.innerHTML = `
        <div class="evolution-content">
            <div class="evolution-bg"></div>
            <div class="evolution-text">
                <h1>🎊 恭喜！</h1>
                <h2>${escapeHtml(student.name)} 进化了！</h2>
                <div class="evolution-stages">
                    <div class="stage-transition">
                        <img src="${oldStage ? oldStage.image : './images/phase1.jpg'}" alt="${oldStage ? oldStage.name : '蛋階段'}" class="old-stage" />
                        <div class="arrow">➜</div>
                        <img src="${newStage.image}" alt="${newStage.name}" class="new-stage" />
                    </div>
                </div>
                <p class="evolution-description">
                    现在是 <strong>${newStage.name}</strong>！
                </p>
                <div class="celebration-particles">
                    ${'🌟'.repeat(20).split('').map((star, i) => `<span class="particle" style="animation-delay: ${i * 0.1}s">${star}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(evolutionOverlay);
    
    // 播放进化音效（如果有的话）
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUeBjiN0vLNeSsFJnfH8N2QQAoUXrTp66hVFApGn+DyvmUeBjiN0vLNeSsFJnfH8N2QQAoUXrTp66hVFApGn+DyvmUeBjiN0vLNeSsFJnfH8N2QQAoUXrTp66hVFApGn+DyvmUeBg==');
        audio.play().catch(() => {}); // 忽略音频播放失败
    } catch (e) {}
    
    // 5秒后自动关闭
    setTimeout(() => {
        if (evolutionOverlay.parentNode) {
            evolutionOverlay.style.opacity = '0';
            setTimeout(() => {
                evolutionOverlay.parentNode.removeChild(evolutionOverlay);
            }, 500);
        }
    }, 5000);
    
    // 点击关闭
    evolutionOverlay.addEventListener('click', () => {
        evolutionOverlay.style.opacity = '0';
        setTimeout(() => {
            if (evolutionOverlay.parentNode) {
                evolutionOverlay.parentNode.removeChild(evolutionOverlay);
            }
        }, 500);
    });
}

// 渲染行為選項
function renderBehaviorOptions() {
    try {
        renderPositiveBehaviors();
        renderNegativeBehaviors();
        renderSupermarketBehaviors();
    } catch (error) {
        console.error('渲染行為選項時出錯:', error);
    }
}

// 渲染正面行為
function renderPositiveBehaviors() {
    const container = document.getElementById('positive-behaviors-grid');
    if (!container) {
        console.error('找不到 positive-behaviors-grid 元素');
        return;
    }
    
    const behaviorOptions = getCurrentBehaviorOptions();
    if (!behaviorOptions || !behaviorOptions.positive) {
        console.error('行為選項未定義');
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 為每個行為創建元素並添加事件監聽器
    behaviorOptions.positive.forEach((behavior, index) => {
        const behaviorElement = document.createElement('div');
        behaviorElement.className = `behavior-item positive-behavior ${isEditMode ? 'edit-mode' : ''}`;
        behaviorElement.innerHTML = `
            <span class="behavior-icon">${behavior.icon}</span>
            <div class="behavior-name">
                <span class="behavior-text">${behavior.name}</span>
                <span class="behavior-points">${behavior.points > 0 ? '+' : ''}${behavior.points}分</span>
            </div>
            ${isEditMode ? `
                <div class="edit-controls">
                    <button class="edit-btn" title="編輯">✏️</button>
                    <button class="delete-btn-behavior" title="刪除">🗑️</button>
                </div>
            ` : ''}
        `;
        
        // 添加點擊事件監聽器（只在老師模式下）
        if (!isEditMode && isTeacherMode) {
            behaviorElement.addEventListener('click', function() {
                selectBehavior(this, behavior);
            });
        } else {
            // 編輯模式下的事件監聽器
            const editBtn = behaviorElement.querySelector('.edit-btn');
            const deleteBtn = behaviorElement.querySelector('.delete-btn-behavior');
            
            if (editBtn) {
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    editBehavior('positive', index);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    deleteBehavior('positive', index);
                });
            }
        }
        
        container.appendChild(behaviorElement);
    });
    
    // 顯示/隱藏新增按鈕
    const addBtn = document.getElementById('addPositiveBtn');
    if (addBtn) {
        addBtn.style.display = isEditMode ? 'block' : 'none';
    }
}

// 渲染負面行為
function renderNegativeBehaviors() {
    const container = document.getElementById('negative-behaviors-grid');
    if (!container) {
        console.error('找不到 negative-behaviors-grid 元素');
        return;
    }
    
    const behaviorOptions = getCurrentBehaviorOptions();
    if (!behaviorOptions || !behaviorOptions.negative) {
        console.error('行為選項未定義');
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 為每個行為創建元素並添加事件監聽器
    behaviorOptions.negative.forEach((behavior, index) => {
        const behaviorElement = document.createElement('div');
        behaviorElement.className = `behavior-item negative-behavior ${isEditMode ? 'edit-mode' : ''}`;
        behaviorElement.innerHTML = `
            <span class="behavior-icon">${behavior.icon}</span>
            <div class="behavior-name">
                <span class="behavior-text">${behavior.name}</span>
                <span class="behavior-points">${behavior.points}分</span>
            </div>
            ${isEditMode ? `
                <div class="edit-controls">
                    <button class="edit-btn" title="編輯">✏️</button>
                    <button class="delete-btn-behavior" title="刪除">🗑️</button>
                </div>
            ` : ''}
        `;
        
        // 添加點擊事件監聽器（只在老師模式下）
        if (!isEditMode && isTeacherMode) {
            behaviorElement.addEventListener('click', function() {
                selectBehavior(this, behavior);
            });
        } else {
            // 編輯模式下的事件監聽器
            const editBtn = behaviorElement.querySelector('.edit-btn');
            const deleteBtn = behaviorElement.querySelector('.delete-btn-behavior');
            
            if (editBtn) {
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    editBehavior('negative', index);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    deleteBehavior('negative', index);
                });
            }
        }
        
        container.appendChild(behaviorElement);
    });
    
    // 顯示/隱藏新增按鈕
    const addBtn = document.getElementById('addNegativeBtn');
    if (addBtn) {
        addBtn.style.display = isEditMode ? 'block' : 'none';
    }
}

// 超級市場變數（簡化版）

// 渲染超級市場商品
function renderSupermarketBehaviors() {
    const container = document.getElementById('supermarket-behaviors-grid');
    if (!container) {
        console.error('找不到 supermarket-behaviors-grid 元素');
        return;
    }
    
    container.innerHTML = '';
    
    const behaviorOptions = getCurrentBehaviorOptions();
    let supermarketBehaviors = behaviorOptions.supermarket || [];
    
    // 如果沒有超級市場資料，使用預設資料
    if (!supermarketBehaviors || supermarketBehaviors.length === 0) {
        supermarketBehaviors = BEHAVIOR_OPTIONS.supermarket || [];
    }
    
    // 直接顯示所有食物，不分類
    supermarketBehaviors.forEach((behavior, index) => {
        const behaviorElement = document.createElement('div');
        behaviorElement.className = 'behavior-item supermarket';
        // 只在老師模式下添加點擊事件
        if (isTeacherMode) {
            behaviorElement.onclick = () => selectBehavior(behaviorElement, behavior);
        }
        
        behaviorElement.innerHTML = `
            <div class="behavior-header">
                <div class="behavior-icon">${behavior.icon}</div>
                <div class="behavior-name">${behavior.name}</div>
                ${isEditMode ? `
                <div class="behavior-actions">
                    <button onclick="event.stopPropagation(); editBehavior('supermarket', ${index})" class="edit-btn" title="編輯">✏️</button>
                    <button onclick="event.stopPropagation(); deleteBehavior('supermarket', ${index})" class="delete-btn" title="刪除">🗑️</button>
                </div>
                ` : ''}
            </div>
            <div class="behavior-points positive">+${behavior.points}</div>
            <div class="behavior-description">${behavior.description || ''}</div>
        `;
        
        container.appendChild(behaviorElement);
    });
    
    // 顯示/隱藏新增按鈕
    const addBtn = document.getElementById('addSupermarketBtn');
    if (addBtn) {
        addBtn.style.display = isEditMode ? 'block' : 'none';
    }
}



// 獲取當前活躍的行為類型
function getCurrentBehaviorType() {
    const activeTab = document.querySelector('.behavior-tab.active');
    if (activeTab) {
        const id = activeTab.id;
        if (id === 'positive-tab') return 'positive';
        if (id === 'negative-tab') return 'negative';
        if (id === 'supermarket-tab') return 'supermarket';
    }
    return 'positive'; // 默認
}

// 切換行為類型標籤
function switchBehaviorType(type) {
    // 更新標籤狀態
    document.querySelectorAll('.behavior-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${type}-tab`).classList.add('active');
    
    // 顯示對應的行為區域
    document.getElementById('positive-behaviors').style.display = type === 'positive' ? 'block' : 'none';
    document.getElementById('negative-behaviors').style.display = type === 'negative' ? 'block' : 'none';
    document.getElementById('supermarket-behaviors').style.display = type === 'supermarket' ? 'block' : 'none';
    
    // 渲染對應的行為選項
    if (type === 'positive') {
        renderPositiveBehaviors();
    } else if (type === 'negative') {
        renderNegativeBehaviors();
    } else if (type === 'supermarket') {
        renderSupermarketBehaviors();
    }
    
    // 清除選中的學生
    clearSelectedStudents();
    
    // 學生模式下確保隱藏學生選擇面板和所有操作按鈕
    if (!isTeacherMode) {
        const selectedStudentsPanel = document.getElementById('selectedStudentsPanel');
        if (selectedStudentsPanel) selectedStudentsPanel.style.display = 'none';
        
        // 確保快速選擇按鈕也隱藏
        const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
        quickSelectBtns.forEach(btn => {
            if (btn) btn.style.display = 'none';
        });
        
        // 確保應用行為按鈕也隱藏
        const applyBtn = document.getElementById('applyBehaviorBtn');
        if (applyBtn) applyBtn.style.display = 'none';
    }
}

// 選擇行為
function selectBehavior(element, behavior) {
    // 移除之前選中的行為
    document.querySelectorAll('.behavior-item.selected').forEach(item => item.classList.remove('selected'));
    
    // 選中當前行為
    element.classList.add('selected');
    selectedBehavior = behavior;
    
    // 檢查當前是否在超級市場標籤
    const currentBehaviorType = getCurrentBehaviorType();
    
    if (currentBehaviorType === 'supermarket') {
        // 超級市場模式：老師直接加分
        isPurchaseMode = false;
        isSelectionMode = true;
        showNotification(`選擇要給 "${behavior.name}" (+${behavior.points}分) 的學生`, 'info');
    } else {
        // 正面/負面行為模式：加減分
        isPurchaseMode = false;
        isSelectionMode = true;
        showNotification('現在請點擊要給分的學生', 'info');
    }
    
    // 重新渲染學生卡片以顯示選擇模式
    renderStudents();
    
    // 顯示已選擇學生面板
    updateSelectedStudentsPanel();
}

// 處理學生選擇
function handleStudentSelection(studentId, event) {
    event.stopPropagation();
    
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const existingIndex = selectedStudents.findIndex(s => s.id === studentId);
    
    if (existingIndex >= 0) {
        // 取消選擇
        selectedStudents.splice(existingIndex, 1);
    } else {
        // 新增選擇
        selectedStudents.push(student);
    }
    
    // 重新渲染學生卡片
    renderStudents();
    
    // 更新已選擇學生面板
    updateSelectedStudentsPanel();
}

// 更新已選擇學生面板
function updateSelectedStudentsPanel() {
    const panel = document.getElementById('selectedStudentsPanel');
    const studentsList = document.getElementById('selectedStudentsList');
    const behaviorText = document.getElementById('selectedBehaviorText');
    const applyBtn = document.getElementById('applyBehaviorBtn');
    const studentsButtonsGrid = document.getElementById('studentsButtonsGrid');
    
    if (selectedBehavior || selectedStudents.length > 0) {
        panel.style.display = 'block';
        
        // 更新選擇的行為文本
        if (selectedBehavior) {
            behaviorText.textContent = `${selectedBehavior.icon} ${selectedBehavior.name} (${selectedBehavior.points > 0 ? '+' : ''}${selectedBehavior.points}分)`;
        }
        
        // 更新已選擇學生列表
        studentsList.innerHTML = selectedStudents.map(student => `
            <div class="selected-student-tag">
                ${escapeHtml(student.name)}
                <span class="remove-student" onclick="removeStudentFromSelection(${student.id})">✕</span>
            </div>
        `).join('');
        
        // 渲染學生按鈕網格
        renderStudentButtons();
        
        // 更新應用按鈕狀態
        applyBtn.disabled = !selectedBehavior || selectedStudents.length === 0;
    } else {
        panel.style.display = 'none';
    }
}

// 渲染學生按鈕網格
function renderStudentButtons() {
    const studentsButtonsGrid = document.getElementById('studentsButtonsGrid');
    if (!studentsButtonsGrid) return;
    
    studentsButtonsGrid.innerHTML = '';
    
    students.forEach(student => {
        const isSelected = selectedStudents.some(s => s.id === student.id);
        const buttonElement = document.createElement('button');
        buttonElement.className = `student-button ${isSelected ? 'selected' : ''}`;
        buttonElement.textContent = student.name;
        buttonElement.title = `${student.name} - ${student.points}分`;
        
        // 只在老師模式下添加點擊事件
        if (isTeacherMode) {
            buttonElement.addEventListener('click', function() {
                toggleStudentFromButton(student.id);
            });
        }
        
        studentsButtonsGrid.appendChild(buttonElement);
    });
}

// 從按鈕切換學生選擇狀態
function toggleStudentFromButton(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    const existingIndex = selectedStudents.findIndex(s => s.id === studentId);
    
    if (existingIndex >= 0) {
        // 取消選擇
        selectedStudents.splice(existingIndex, 1);
    } else {
        // 新增選擇
        selectedStudents.push(student);
    }
    
    // 重新渲染學生卡片和面板
    renderStudents();
    updateSelectedStudentsPanel();
}

// 全選學生
function selectAllStudents() {
    selectedStudents = [...students];
    renderStudents();
    updateSelectedStudentsPanel();
    showNotification('已選擇所有學生', 'info');
}

// 取消全選學生
function deselectAllStudents() {
    selectedStudents = [];
    renderStudents();
    updateSelectedStudentsPanel();
    showNotification('已取消選擇所有學生', 'info');
}

// 從選擇中移除學生
function removeStudentFromSelection(studentId) {
    const index = selectedStudents.findIndex(s => s.id === studentId);
    if (index >= 0) {
        selectedStudents.splice(index, 1);
        renderStudents();
        updateSelectedStudentsPanel();
    }
}

// 取消選擇
function cancelSelection() {
    selectedStudents = [];
    selectedBehavior = null;
    isSelectionMode = false;
    isPurchaseMode = false;
    
    // 移除所有行為選中狀態
    document.querySelectorAll('.behavior-item.selected').forEach(item => item.classList.remove('selected'));
    
    // 重新渲染學生卡片
    renderStudents();
    
    // 隱藏已選擇學生面板
    document.getElementById('selectedStudentsPanel').style.display = 'none';
}

// 應用選擇的行為
async function applySelectedBehavior() {
    // 安全檢查：學生模式下禁止應用行為
    if (!isTeacherMode) {
        console.warn('安全提示：學生模式下無法應用行為');
        showError('需要老師權限才能進行此操作');
        return;
    }
    
    if (!selectedBehavior || selectedStudents.length === 0) {
        showError('請先選擇行為和學生');
        return;
    }
    
    try {
        // 統一使用加分模式（移除購買概念）
        const promises = selectedStudents.map(student => 
            adjustPointsWithAnimation(student.id, selectedBehavior.points, selectedBehavior.name)
        );
        
        await Promise.all(promises);
        
        const actionType = getCurrentBehaviorType() === 'supermarket' ? '獎勵' : '應用';
        showSuccess(`已為 ${selectedStudents.length} 位學生${actionType}「${selectedBehavior.name}」`);
        
        // 清除選擇狀態
        cancelSelection();
        
    } catch (error) {
        showError((isPurchaseMode ? '購買失敗' : '應用行為失敗') + ': ' + error.message);
    }
}

// 切換編輯模式
function toggleEditMode() {
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('editModeBtn');
    
    if (isEditMode) {
        editBtn.textContent = '🔒 退出編輯';
        editBtn.classList.add('active');
        showNotification('進入編輯模式，可以新增、修改或刪除行為', 'info');
    } else {
        editBtn.textContent = '✏️ 編輯模式';
        editBtn.classList.remove('active');
        showNotification('退出編輯模式', 'info');
    }
    
    // 重新渲染行為選項
    renderBehaviorOptions();
}

// 顯示新增行為模態框
function showAddBehaviorModal(type) {
    editingBehaviorIndex = -1;
    editingBehaviorType = type;
    
    const modal = document.getElementById('behaviorModal');
    const title = document.getElementById('behaviorModalTitle');
    
    title.textContent = 
        type === 'positive' ? '新增正面行為' : 
        type === 'negative' ? '新增改進行為' : 
        '新增商品';
    
    // 清空表單
    document.getElementById('behaviorIcon').value = '';
    document.getElementById('behaviorName').value = '';
    document.getElementById('behaviorPoints').value = 
        type === 'positive' ? '1' : 
        type === 'negative' ? '-1' : '2';
    document.getElementById('behaviorDescription').value = '';
    
    modal.style.display = 'block';
}

// 編輯行為
function editBehavior(type, index) {
    editingBehaviorIndex = index;
    editingBehaviorType = type;
    
    const behaviorOptions = getCurrentBehaviorOptions();
    const behavior = behaviorOptions[type][index];
    
    const modal = document.getElementById('behaviorModal');
    const title = document.getElementById('behaviorModalTitle');
    
    title.textContent = 
        type === 'positive' ? '編輯正面行為' : 
        type === 'negative' ? '編輯改進行為' : 
        '編輯商品';
    
    // 填入現有資料
    document.getElementById('behaviorIcon').value = behavior.icon;
    document.getElementById('behaviorName').value = behavior.name;
    document.getElementById('behaviorPoints').value = behavior.points;
    document.getElementById('behaviorDescription').value = behavior.description || '';
    
    modal.style.display = 'block';
}

// 刪除行為
function deleteBehavior(type, index) {
    const behaviorOptions = getCurrentBehaviorOptions();
    const behavior = behaviorOptions[type][index];
    
    if (confirm(`確定要刪除「${behavior.name}」行為嗎？`)) {
        // 確保有自定義行為配置
        if (!customBehaviors) {
            customBehaviors = JSON.parse(JSON.stringify(BEHAVIOR_OPTIONS));
        }
        
        customBehaviors[type].splice(index, 1);
        saveCustomBehaviors();
        renderBehaviorOptions();
        showSuccess(`已刪除「${behavior.name}」行為`);
    }
}

// 保存行為
function saveBehavior(event) {
    event.preventDefault();
    
    const icon = document.getElementById('behaviorIcon').value.trim();
    const name = document.getElementById('behaviorName').value.trim();
    const points = parseInt(document.getElementById('behaviorPoints').value);
    const description = document.getElementById('behaviorDescription').value.trim();
    
    if (!icon || !name || isNaN(points)) {
        showError('請填寫所有必填欄位');
        return;
    }
    
    const newBehavior = {
        icon: icon,
        name: name,
        points: points,
        description: description
    };
    
    // 確保有自定義行為配置
    if (!customBehaviors) {
        customBehaviors = JSON.parse(JSON.stringify(BEHAVIOR_OPTIONS));
    }
    
    if (editingBehaviorIndex === -1) {
        // 新增行為
        customBehaviors[editingBehaviorType].push(newBehavior);
        showSuccess(`已新增「${name}」行為`);
    } else {
        // 編輯行為
        customBehaviors[editingBehaviorType][editingBehaviorIndex] = newBehavior;
        showSuccess(`已更新「${name}」行為`);
    }
    
    saveCustomBehaviors();
    renderBehaviorOptions();
    closeBehaviorModal();
}

// 關閉行為編輯模態框
function closeBehaviorModal() {
    document.getElementById('behaviorModal').style.display = 'none';
    editingBehaviorIndex = -1;
    editingBehaviorType = '';
}

// ===================
// 排行榜功能
// ===================

// 標籤頁切換功能
function switchTab(tabName) {
    // 移除所有標籤頁的active類
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 激活選中的標籤頁
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.getElementById(`${tabName}-content`).classList.add('active');
    
    // 如果切換到排行榜頁面，載入數據
    if (tabName === 'ranking') {
        // 確保階段配置已初始化
        if (!customStages) {
            loadCustomStages();
        }
        loadRankingData();
    } else if (tabName === 'logs') {
        loadLogs();
    }
}

// 時間篩選切換
function switchTimeFilter(timeType) {
    currentTimeFilter = timeType;
    
    // 更新標籤樣式
    document.querySelectorAll('.time-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${timeType}-tab`).classList.add('active');
    
    // 確保階段配置已初始化
    if (!customStages) {
        loadCustomStages();
    }
    
    // 重新載入數據
    loadRankingData();
}

// 載入排行榜數據
async function loadRankingData() {
    try {
        // 確保階段配置已初始化
        if (!customStages) {
            loadCustomStages();
        }
        // 獲取學生和記錄數據
        const [studentsResponse, logsResponse] = await Promise.all([
            fetch(`${API_BASE}/students`),
            fetch(`${API_BASE}/logs`)
        ]);
        
        const studentsData = await studentsResponse.json();
        const logsData = await logsResponse.json();
        
        if (studentsResponse.ok && logsResponse.ok) {
            students = studentsData;
            logs = logsData;
            
            // 根據時間篩選條件過濾記錄
            const filteredLogs = filterLogsByTime(logs, currentTimeFilter);
            
            // 生成排行榜數據
            rankingData = generateRankingData(students, filteredLogs, logs);
            
            // 更新各個組件（移除圖表相關功能）
            updateStudentRanking();
        }
    } catch (error) {
        console.error('載入排行榜數據失敗:', error);
        console.error('錯誤詳情:', error.stack);
        
        // 檢查是否是階段配置問題
        const stages = getCurrentStageConfig();
        if (!stages || stages.length === 0) {
            console.error('階段配置錯誤:', stages);
            showError('階段配置有誤，請檢查進化階段設定');
        } else {
            showError('載入排行榜數據失敗，請重試：' + error.message);
        }
    }
}

// 根據時間篩選記錄
function filterLogsByTime(logs, timeFilter) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return logs.filter(log => {
        const logDate = new Date(log.timestamp);
        
        switch (timeFilter) {
            case 'week':
                // 本週（從週一開始）
                const startOfWeek = new Date(startOfToday);
                const dayOfWeek = startOfToday.getDay();
                const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 週日為0，調整為週一開始
                startOfWeek.setDate(startOfToday.getDate() - daysToSubtract);
                return logDate >= startOfWeek;
                
            case 'lastweek':
                // 上週
                const startOfLastWeek = new Date(startOfToday);
                const endOfLastWeek = new Date(startOfToday);
                const dayOfWeek2 = startOfToday.getDay();
                const daysToSubtract2 = dayOfWeek2 === 0 ? 6 : dayOfWeek2 - 1;
                startOfLastWeek.setDate(startOfToday.getDate() - daysToSubtract2 - 7);
                endOfLastWeek.setDate(startOfToday.getDate() - daysToSubtract2);
                return logDate >= startOfLastWeek && logDate < endOfLastWeek;
                
            case 'month':
                // 本月
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return logDate >= startOfMonth;
                
            case 'all':
            default:
                return true;
        }
    });
}

// 生成排行榜數據  
function generateRankingData(students, filteredLogs, allLogs = null) {
    const behaviorOptions = getCurrentBehaviorOptions();
    
    // 計算每個學生的統計數據
    const studentStats = students.map(student => {
        const studentLogs = filteredLogs.filter(log => log.student_id === student.id);
        const totalPoints = studentLogs.reduce((sum, log) => sum + log.points_change, 0);
        
        return {
            ...student,
            logsCount: studentLogs.length,
            totalPoints: totalPoints,
            currentScore: student.points, // 當前總分
            stage: getStageByPoints(student.points)
        };
    });
    
    // 排序學生（按當前總分排序）
    studentStats.sort((a, b) => b.currentScore - a.currentScore);
    
    // 計算行為統計
    const behaviorStats = {};
    let totalPointsFromLogs = 0;
    
    // 初始化行為統計
    if (behaviorOptions.positive) {
        behaviorOptions.positive.forEach(behavior => {
            behaviorStats[behavior.name] = {
                icon: behavior.icon,
                count: 0,
                totalPoints: 0,
                type: 'positive'
            };
        });
    }
    
    if (behaviorOptions.negative) {
        behaviorOptions.negative.forEach(behavior => {
            behaviorStats[behavior.name] = {
                icon: behavior.icon,
                count: 0,
                totalPoints: 0,
                type: 'negative'
            };
        });
    }
    
    // 統計行為數據
    filteredLogs.forEach(log => {
        if (behaviorStats[log.reason]) {
            behaviorStats[log.reason].count++;
            behaviorStats[log.reason].totalPoints += log.points_change;
        }
        totalPointsFromLogs += Math.abs(log.points_change);
    });
    
    // 計算進步之星（本週相比上週的進步）
    let improvementStar = null;
    if (currentTimeFilter === 'week' && allLogs) {
        const lastWeekLogs = filterLogsByTime(allLogs, 'lastweek');
        const thisWeekLogs = filteredLogs;
        
        let maxImprovement = 0;
        students.forEach(student => {
            const lastWeekPoints = lastWeekLogs
                .filter(log => log.student_id === student.id)
                .reduce((sum, log) => sum + log.points_change, 0);
            const thisWeekPoints = thisWeekLogs
                .filter(log => log.student_id === student.id)
                .reduce((sum, log) => sum + log.points_change, 0);
            
            const improvement = thisWeekPoints - lastWeekPoints;
            if (improvement > maxImprovement) {
                maxImprovement = improvement;
                improvementStar = {
                    student: student,
                    improvement: improvement
                };
            }
        });
    }
    
    return {
        students: studentStats,
        behaviorStats: behaviorStats,
        totalPointsFromLogs: totalPointsFromLogs,
        improvementStar: improvementStar,
        timeFilter: currentTimeFilter
    };
}

// 評價分布圖表功能已移除，排行榜頁面已簡化
function updateEvaluationChart() {
    // 此功能已移除，因為排行榜頁面只保留學生排行榜
    return;
}

// 繪製餅圖
function drawPieChart(ctx, data, centerX, centerY, radius) {
    // 圖表功能已移除
    return;
    
    data.forEach((item, index) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        // 繪製扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        
        // 繪製邊框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 繪製標籤（如果扇形足夠大）
        if (sliceAngle > 0.3) { // 只在扇形足夠大時顯示標籤
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
            const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
            
            ctx.font = '14px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, labelX, labelY);
        }
        
        currentAngle += sliceAngle;
    });
}

// 更新圖表圖例
function updateChartLegend(data) {
    // 圖表功能已移除
    return;
    
    legendContainer.innerHTML = data.map(item => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        return `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <span class="legend-text">${item.icon} ${item.name}</span>
                <span class="legend-percentage">${percentage}%</span>
            </div>
        `;
    }).join('');
}

// 更新星光榜
function updateStarBoard() {
    // 星光榜功能已移除
    return;
    
    // 最佳學生（分數最高）
    const bestStudent = rankingData.students[0];
    const bestStudentElement = document.getElementById('bestStudent');
    
    bestStudentElement.querySelector('.winner-name').textContent = bestStudent.name;
    bestStudentElement.querySelector('.winner-score').textContent = `${bestStudent.currentScore} 分`;
    
    // 進步之星
    const improvementElement = document.getElementById('improvementStar');
    if (rankingData.improvementStar && rankingData.improvementStar.improvement > 0) {
        improvementElement.querySelector('.winner-name').textContent = rankingData.improvementStar.student.name;
        improvementElement.querySelector('.winner-improvement').textContent = `+${rankingData.improvementStar.improvement} 分`;
    } else {
        improvementElement.querySelector('.winner-name').textContent = '暫無進步';
        improvementElement.querySelector('.winner-improvement').textContent = '--';
    }
}

// 更新學生排行榜
function updateStudentRanking() {
    if (!rankingData) return;
    
    const rankingList = document.getElementById('studentRankingList');
    
    rankingList.innerHTML = rankingData.students.slice(0, 10).map((student, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        
        return `
            <div class="ranking-item ${rankClass}">
                <div class="rank-number ${rankClass}">${rank}</div>
                <div class="student-info">
                    <img src="${student.stage.image}" alt="${student.stage.name}" class="student-avatar" />
                    <div class="student-details">
                        <div class="student-name">${student.name}</div>
                        <div class="student-stage-badge">
                            <span class="stage-level">${student.stage.name}</span>
                            <span class="stage-description">${student.stage.description || ''}</span>
                        </div>
                    </div>
                </div>
                <div class="student-score-container">
                    <div class="student-score">${student.currentScore}</div>
                    <div class="score-label">分</div>
                </div>
            </div>
        `;
    }).join('');
}

// 更新行為分析表格
function updateBehaviorAnalysis() {
    // 行為分析功能已移除
    return;
    
    const tableBody = document.querySelector('#behaviorAnalysisTable tbody');
    const behaviorStats = rankingData.behaviorStats;
    const totalCount = Object.values(behaviorStats).reduce((sum, stat) => sum + stat.count, 0);
    
    if (totalCount === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">暫無數據</td></tr>';
        return;
    }
    
    const sortedBehaviors = Object.entries(behaviorStats)
        .filter(([name, stats]) => stats.count > 0)
        .sort(([, a], [, b]) => b.count - a.count);
    
    tableBody.innerHTML = sortedBehaviors.map(([name, stats]) => {
        const percentage = ((stats.count / totalCount) * 100).toFixed(1);
        
        return `
            <tr>
                <td>${stats.icon} ${name}</td>
                <td>${stats.count}</td>
                <td>
                    <div>${percentage}%</div>
                    <div class="percentage-bar">
                        <div class="percentage-fill" style="width: ${percentage}%"></div>
                    </div>
                </td>
                <td>${stats.totalPoints > 0 ? '+' : ''}${stats.totalPoints}</td>
            </tr>
        `;
    }).join('');
}

// 初始化排行榜頁面
function initializeRanking() {
    // 頁面載入時默認顯示主頁
    switchTab('main');
    
    // 綁定評價分布篩選器
    // 評價篩選器已移除
}

// ===================
// 進化階段編輯功能
// ===================

// 載入自定義階段配置
function loadCustomStages() {
    const saved = localStorage.getItem('customStages');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // 檢查自定義階段是否有效且包含image屬性
            if (parsed && Array.isArray(parsed) && parsed.length > 0 && parsed.every(stage => stage.image)) {
                customStages = parsed;
                console.log('載入自定義階段配置:', customStages);
            } else {
                console.log('自定義階段配置無效，使用默認配置');
                customStages = null;
                localStorage.removeItem('customStages'); // 清除無效配置
            }
        } catch (error) {
            console.error('載入自定義階段失敗:', error);
            customStages = null;
            localStorage.removeItem('customStages'); // 清除無效配置
        }
    }
}

// 保存自定義階段配置
function saveCustomStages() {
    if (customStages) {
        localStorage.setItem('customStages', JSON.stringify(customStages));
        console.log('自定義階段已保存');
    }
}

// 獲取當前階段配置
function getCurrentStageConfig() {
    // 如果有自定義階段配置，使用自定義的
    if (customStages && Array.isArray(customStages) && customStages.length > 0) {
        console.log('使用自定義階段配置:', customStages);
        return customStages;
    }
    
    // 否則返回默認的10個階段配置 (每20分一級)
    const defaultStages = [
        { image: './images/phase1.jpg', name: '第1級', min: 0, max: 19, description: '初始階段' },
        { image: './images/phase2.jpg', name: '第2級', min: 20, max: 39, description: '開始成長' },
        { image: './images/phase3.jpg', name: '第3級', min: 40, max: 59, description: '持續進步' },
        { image: './images/phase4.jpg', name: '第4級', min: 60, max: 79, description: '穩定發展' },
        { image: './images/phase5.jpg', name: '第5級', min: 80, max: 99, description: '加速成長' },
        { image: './images/phase6.jpg', name: '第6級', min: 100, max: 119, description: '突破自我' },
        { image: './images/phase7.jpg', name: '第7級', min: 120, max: 139, description: '優秀表現' },
        { image: './images/phase8.jpg', name: '第8級', min: 140, max: 159, description: '卓越水準' },
        { image: './images/phase9.jpg', name: '第9級', min: 160, max: 179, description: '接近完美' },
        { image: './images/phase10.jpg', name: '第10級', min: 180, max: 999999, description: '完美境界' }
    ];
    console.log('使用默認階段配置:', defaultStages);
    return defaultStages;
}

// 根據分數獲取階段信息
function getStageByPoints(points) {
    const stages = getCurrentStageConfig();
    for (let stage of stages) {
        if (points >= stage.min && points <= stage.max) {
            return {
                image: stage.image,
                name: stage.name,
                min: stage.min,
                max: stage.max,
                description: stage.description || ''
            };
        }
    }
    
    // 如果沒有匹配的階段，返回最高階段
    const highestStage = stages[stages.length - 1];
    return {
        image: highestStage.image,
        name: highestStage.name,
        min: highestStage.min,
        max: highestStage.max,
        description: highestStage.description || ''
    };
}

// 渲染進化階段
function renderStages() {
    const container = document.getElementById('stagesContainer');
    if (!container) {
        console.error('找不到 stagesContainer 元素');
        return;
    }
    
    const stages = getCurrentStageConfig();
    
    // 清空容器
    container.innerHTML = '';
    
    // 為每個階段創建元素
    stages.forEach((stage, index) => {
        const stageElement = document.createElement('div');
        stageElement.className = `stage-item ${isStageEditMode ? 'edit-mode' : ''}`;
        
        const pointsText = stage.max === 999999 ? `${stage.min}分以上` : `${stage.min}-${stage.max}分`;
        
        stageElement.innerHTML = `
            <div class="stage-photo-section">
                <div class="stage-photo-display">
                    <img src="${stage.image}" alt="${stage.name}" class="stage-image-display" />
                </div>
            </div>
            
            <div class="stage-name">${stage.name}</div>
            <div class="stage-points">${pointsText}</div>
            <div class="stage-description">${stage.description || ''}</div>
            ${isStageEditMode ? `
                <div class="stage-controls">
                    <button class="stage-edit-btn" title="編輯">✏️ 編輯</button>
                    <button class="stage-delete-btn" title="刪除">🗑️ 刪除</button>
                </div>
            ` : ''}
        `;
        
        // 在編輯模式下添加事件監聽器
        if (isStageEditMode) {
            const editBtn = stageElement.querySelector('.stage-edit-btn');
            const deleteBtn = stageElement.querySelector('.stage-delete-btn');
            
            if (editBtn) {
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    editStage(index);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    deleteStage(index);
                });
            }
        }
        
        container.appendChild(stageElement);
    });
    
    // 顯示/隱藏新增按鈕
    const addBtn = document.getElementById('addStageBtn');
    if (addBtn) {
        addBtn.style.display = isStageEditMode ? 'block' : 'none';
    }
}

// 切換階段編輯模式
function toggleStageEditMode() {
    isStageEditMode = !isStageEditMode;
    
    const btn = document.getElementById('stageEditModeBtn');
    if (btn) {
        if (isStageEditMode) {
            btn.textContent = '✅ 完成編輯';
            btn.classList.add('active');
        } else {
            btn.textContent = '✏️ 編輯模式';
            btn.classList.remove('active');
        }
    }
    
    renderStages();
}





// 顯示新增階段模態框
function showAddStageModal() {
    editingStageIndex = -1;
    
    document.getElementById('stageModalTitle').textContent = '新增階段';
    document.getElementById('stageImage').value = '';
    document.getElementById('stageName').value = '';
    document.getElementById('stageMinPoints').value = '';
    document.getElementById('stageMaxPoints').value = '';
    document.getElementById('stageDescription').value = '';
    
    document.getElementById('stageModal').style.display = 'block';
}

// 編輯階段
function editStage(index) {
    const stages = getCurrentStageConfig();
    if (index < 0 || index >= stages.length) return;
    
    editingStageIndex = index;
    const stage = stages[index];
    
    document.getElementById('stageModalTitle').textContent = '編輯階段';
    document.getElementById('stageImage').value = stage.image;
    document.getElementById('stageName').value = stage.name;
    document.getElementById('stageMinPoints').value = stage.min;
    document.getElementById('stageMaxPoints').value = stage.max === 999999 ? '' : stage.max;
    document.getElementById('stageDescription').value = stage.description || '';
    
    document.getElementById('stageModal').style.display = 'block';
}

// 刪除階段
function deleteStage(index) {
    const stages = getCurrentStageConfig();
    if (index < 0 || index >= stages.length) return;
    
    if (stages.length <= 1) {
        showError('至少需要保留一個階段');
        return;
    }
    
    const stage = stages[index];
    if (confirm(`確定要刪除「${stage.name}」階段嗎？`)) {
        // 確保使用自定義階段數組
        if (!customStages) {
            customStages = [...stages];
        }
        
        customStages.splice(index, 1);
        saveCustomStages();
        renderStages();
        
        showSuccess(`已刪除「${stage.name}」階段`);
        
        // 重新載入階段圖片
        setTimeout(() => {
            loadStagePhotos();
        }, 100);
        
        // 重新渲染學生（因為階段可能改變）
        renderStudents();
    }
}

// 保存階段
function saveStage(event) {
    event.preventDefault();
    
    const image = document.getElementById('stageImage').value.trim();
    const name = document.getElementById('stageName').value.trim();
    const minPoints = parseInt(document.getElementById('stageMinPoints').value);
    const maxPointsValue = document.getElementById('stageMaxPoints').value.trim();
    const maxPoints = maxPointsValue === '' ? 999999 : parseInt(maxPointsValue);
    const description = document.getElementById('stageDescription').value.trim();
    
    // 驗證輸入
    if (!image || !name) {
        showError('請填寫必要信息');
        return;
    }
    
    if (isNaN(minPoints) || minPoints < 0) {
        showError('最低分數必須為非負數');
        return;
    }
    
    if (!isNaN(maxPoints) && maxPoints < minPoints) {
        showError('最高分數不能小於最低分數');
        return;
    }
    
    const stages = getCurrentStageConfig();
    
    // 確保使用自定義階段數組
    if (!customStages) {
        customStages = [...stages];
    }
    
    const newStage = {
        image: image,
        name: name,
        min: minPoints,
        max: maxPoints,
        description: description
    };
    
    if (editingStageIndex === -1) {
        // 新增階段
        customStages.push(newStage);
        showSuccess(`已新增「${name}」階段`);
    } else {
        // 編輯階段
        customStages[editingStageIndex] = newStage;
        showSuccess(`已更新「${name}」階段`);
    }
    
    // 按最低分數排序階段
    customStages.sort((a, b) => a.min - b.min);
    
    saveCustomStages();
    renderStages();
    closeStageModal();
    
    // 重新載入階段圖片
    setTimeout(() => {
        loadStagePhotos();
    }, 100);
    
    // 重新渲染學生（因為階段可能改變）
    renderStudents();
}

// 關閉階段編輯模態框
function closeStageModal() {
    document.getElementById('stageModal').style.display = 'none';
    editingStageIndex = -1;
}

// 老師模式切換
function toggleTeacherMode() {
    if (isTeacherMode) {
        // 退出老師模式
        exitTeacherMode();
    } else {
        // 進入老師模式 - 需要密碼驗證
        showTeacherPasswordModal();
    }
}

// 顯示老師密碼輸入框
function showTeacherPasswordModal() {
    document.getElementById('teacherPasswordModal').style.display = 'block';
    document.getElementById('teacherPassword').value = '';
    document.getElementById('teacherPassword').focus();
}

// 關閉老師密碼輸入框
function closeTeacherPasswordModal() {
    document.getElementById('teacherPasswordModal').style.display = 'none';
    document.getElementById('teacherPassword').value = '';
}

// 驗證老師密碼
async function verifyTeacherPassword(event) {
    event.preventDefault();
    
    const inputPassword = document.getElementById('teacherPassword').value;
    
    if (!inputPassword) {
        showError('請輸入密碼');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/verify-teacher`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: inputPassword })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // 密碼正確，進入老師模式
            enterTeacherMode();
            closeTeacherPasswordModal();
            showSuccess('已進入老師模式！');
        } else {
            // 密碼錯誤
            showError(data.error || '密碼錯誤，請重試');
            document.getElementById('teacherPassword').value = '';
            document.getElementById('teacherPassword').focus();
        }
    } catch (error) {
        showError('網路錯誤，請檢查連線：' + error.message);
        console.error('Teacher password verification error:', error);
    }
}

// 進入老師模式
function enterTeacherMode() {
    isTeacherMode = true;
    
    // 更新老師模式按鈕狀態
    const teacherModeBtn = document.getElementById('teacherModeBtn');
    const teacherModeIcon = document.getElementById('teacherModeIcon');
    const teacherModeText = document.getElementById('teacherModeText');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    
    teacherModeBtn.classList.add('active');
    teacherModeIcon.textContent = '🔓';
    teacherModeText.textContent = '退出老師模式';
    
    // 顯示修改密碼按鈕
    if (changePasswordBtn) {
        changePasswordBtn.style.display = 'flex';
    }
    
    // 顯示所有編輯功能
    showAllEditFeatures();
    
    // 重新渲染界面
    renderBehaviorOptions();
    renderStages();
    renderStudents();
}

// 退出老師模式
function exitTeacherMode() {
    isTeacherMode = false;
    isEditMode = false;
    isStageEditMode = false;
    
    // 更新老師模式按鈕狀態
    const teacherModeBtn = document.getElementById('teacherModeBtn');
    const teacherModeIcon = document.getElementById('teacherModeIcon');
    const teacherModeText = document.getElementById('teacherModeText');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    
    teacherModeBtn.classList.remove('active');
    teacherModeIcon.textContent = '🔒';
    teacherModeText.textContent = '老師模式';
    
    // 隱藏修改密碼按鈕
    if (changePasswordBtn) {
        changePasswordBtn.style.display = 'none';
    }
    
    // 隱藏所有編輯功能
    hideAllEditFeatures();
    
    // 重新渲染界面
    renderBehaviorOptions();
    renderStages();
    renderStudents();
    
    showSuccess('已退出老師模式');
}

// 顯示所有編輯功能
function showAllEditFeatures() {
    // 顯示新增學生功能
    const addStudentSection = document.querySelector('.add-student-section');
    if (addStudentSection) addStudentSection.style.display = 'block';
    
    // 顯示全班操作功能
    const bulkActions = document.querySelector('.bulk-actions');
    if (bulkActions) bulkActions.style.display = 'block';
    
    // 顯示階段編輯按鈕
    const stageEditBtn = document.getElementById('stageEditModeBtn');
    if (stageEditBtn) stageEditBtn.style.display = 'block';
    
    // 顯示編輯模式按鈕
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) editModeBtn.style.display = 'block';
    
    // 顯示已選擇學生面板（老師模式需要選擇功能）
    const selectedStudentsPanel = document.getElementById('selectedStudentsPanel');
    if (selectedStudentsPanel) {
        selectedStudentsPanel.style.display = 'block';
        selectedStudentsPanel.style.visibility = 'visible';
    }
    
    // 恢復所有相關的操作按鈕顯示
    const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
    quickSelectBtns.forEach(btn => {
        if (btn) {
            btn.style.display = 'inline-block';
            btn.style.visibility = 'visible';
        }
    });
    
    const applyBtn = document.getElementById('applyBehaviorBtn');
    if (applyBtn) {
        applyBtn.style.display = 'block';
        applyBtn.style.visibility = 'visible';
    }
    
    // 顯示行為評分區域（老師模式需要操作功能）
    const behaviorsSection = document.querySelector('.behaviors-section');
    if (behaviorsSection) {
        behaviorsSection.style.display = 'block';
        behaviorsSection.classList.remove('student-view-only');
    }
    
    // 恢復行為項目的點擊功能（老師模式可以操作）
    enableBehaviorInteraction();
    
    // 添加老師模式提示
    addTeacherModeNotice();
}

// 隱藏所有編輯功能
function hideAllEditFeatures() {
    // 隱藏新增學生功能
    const addStudentSection = document.querySelector('.add-student-section');
    if (addStudentSection) addStudentSection.style.display = 'none';
    
    // 隱藏全班操作功能
    const bulkActions = document.querySelector('.bulk-actions');
    if (bulkActions) bulkActions.style.display = 'none';
    
    // 隱藏階段編輯按鈕
    const stageEditBtn = document.getElementById('stageEditModeBtn');
    if (stageEditBtn) stageEditBtn.style.display = 'none';
    
    // 隱藏編輯模式按鈕
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) editModeBtn.style.display = 'none';
    
    // 隱藏所有新增按鈕
    const addButtons = document.querySelectorAll('.add-behavior-btn, .add-stage-btn');
    addButtons.forEach(btn => btn.style.display = 'none');
    
    // 隱藏已選擇學生面板（學生模式不需要選擇功能）
    const selectedStudentsPanel = document.getElementById('selectedStudentsPanel');
    if (selectedStudentsPanel) {
        selectedStudentsPanel.style.display = 'none';
        selectedStudentsPanel.style.visibility = 'hidden';
    }
    
    // 確保所有相關的操作按鈕都隱藏
    const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
    quickSelectBtns.forEach(btn => {
        if (btn) {
            btn.style.display = 'none';
            btn.style.visibility = 'hidden';
        }
    });
    
    const applyBtn = document.getElementById('applyBehaviorBtn');
    if (applyBtn) {
        applyBtn.style.display = 'none';
        applyBtn.style.visibility = 'hidden';
    }
    
    // 顯示行為評分區域（學生模式可以看到但不能操作）
    const behaviorsSection = document.querySelector('.behaviors-section');
    if (behaviorsSection) {
        behaviorsSection.style.display = 'block';
        behaviorsSection.classList.add('student-view-only');
    }
    
    // 禁用所有行為項目的點擊功能
    disableBehaviorInteraction();
}

// 禁用行為項目交互（學生模式只能查看）
function disableBehaviorInteraction() {
    // 禁用所有行為項目的點擊
    const behaviorItems = document.querySelectorAll('.behavior-item');
    behaviorItems.forEach(item => {
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.7';
        item.style.cursor = 'not-allowed';
        // 完全移除所有點擊事件
        item.onclick = null;
        item.onmousedown = null;
        item.onmouseup = null;
        item.ontouchstart = null;
        item.ontouchend = null;
        // 移除所有可能的事件監聽器
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
    });
    
    // 禁用學生選擇功能（安全考量）
    const studentCards = document.querySelectorAll('.student-card');
    studentCards.forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.8';
        card.style.cursor = 'not-allowed';
        card.classList.remove('selected');
        // 移除點擊事件監聽器
        card.onclick = null;
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
    });
    
    // 禁用快速選擇按鈕
    const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
    quickSelectBtns.forEach(btn => {
        if (btn) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    // 禁用應用行為按鈕
    const applyBtn = document.getElementById('applyBehaviorBtn');
    if (applyBtn) {
        applyBtn.style.pointerEvents = 'none';
        applyBtn.style.opacity = '0.5';
        applyBtn.style.cursor = 'not-allowed';
    }
    
    // 只保持行為標籤切換功能（學生可以瀏覽不同分類）
    const behaviorTabs = document.querySelectorAll('.behavior-tab');
    behaviorTabs.forEach(tab => {
        tab.style.pointerEvents = 'auto';
        tab.style.opacity = '1';
        tab.style.cursor = 'pointer';
    });
    
    // 清空已選學生（安全考量）
    selectedStudents = [];
    
    // 清空已選學生顯示
    const selectedStudentsList = document.getElementById('selectedStudentsList');
    if (selectedStudentsList) selectedStudentsList.innerHTML = '';
    
    // 添加提示文字
    addStudentViewNotice();
}

// 啟用行為項目交互（老師模式或編輯模式）
function enableBehaviorInteraction() {
    // 恢復所有行為項目的點擊
    const behaviorItems = document.querySelectorAll('.behavior-item');
    behaviorItems.forEach(item => {
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
        item.style.cursor = 'pointer';
    });
    
    // 恢復學生選擇功能
    const studentCards = document.querySelectorAll('.student-card');
    studentCards.forEach(card => {
        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
        card.style.cursor = 'pointer';
    });
    
    // 恢復快速選擇按鈕
    const quickSelectBtns = document.querySelectorAll('#selectAllBtn, #clearAllBtn');
    quickSelectBtns.forEach(btn => {
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
    
    // 恢復應用行為按鈕
    const applyBtn = document.getElementById('applyBehaviorBtn');
    if (applyBtn) {
        applyBtn.style.pointerEvents = 'auto';
        applyBtn.style.opacity = '1';
        applyBtn.style.cursor = 'pointer';
    }
    
    // 重新渲染學生卡片以恢復事件監聽器
    renderStudents();
    
    // 恢復行為標籤切換
    const behaviorTabs = document.querySelectorAll('.behavior-tab');
    behaviorTabs.forEach(tab => {
        tab.style.pointerEvents = 'auto';
        tab.style.opacity = '1';
    });
    
    // 移除提示文字
    removeStudentViewNotice();
    removeTeacherModeNotice();
}

// 添加學生查看模式提示 (已停用)
function addStudentViewNotice() {
    // 功能已停用 - 不再顯示學生模式提示文字
    return;
}

// 移除學生查看模式提示
function removeStudentViewNotice() {
    const notice = document.querySelector('.student-view-notice');
    if (notice) {
        notice.remove();
    }
}

// 添加老師模式提示
function addTeacherModeNotice() {
    // 避免重複添加
    if (document.querySelector('.teacher-mode-notice')) return;
    
    const behaviorsSection = document.querySelector('.behaviors-section');
    if (behaviorsSection) {
        const notice = document.createElement('div');
        notice.className = 'teacher-mode-notice';
        notice.innerHTML = `
            <div class="notice-content">
                <span class="notice-icon">👨‍🏫</span>
                <span class="notice-text">老師管理模式 - 完整操作權限</span>
                <span class="notice-subtitle">可以進行所有評分和管理操作</span>
            </div>
        `;
        behaviorsSection.insertBefore(notice, behaviorsSection.firstChild);
    }
}

// 移除老師模式提示
function removeTeacherModeNotice() {
    const notice = document.querySelector('.teacher-mode-notice');
    if (notice) {
        notice.remove();
    }
}

// 初始化階段功能
function initializeStages() {
    loadCustomStages();
    renderStages();
}

// 處理照片點擊事件






// 顯示修改密碼模態框
function showChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'block';
    // 清空表單
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    document.getElementById('currentPasswordInput').focus();
}

// 關閉修改密碼模態框
function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
    // 清空表單
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
}

// 修改老師密碼
async function changeTeacherPassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    
    // 驗證輸入
    if (!currentPassword || !newPassword || !confirmPassword) {
        showError('請填寫所有欄位');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('新密碼與確認密碼不一致');
        document.getElementById('confirmPasswordInput').focus();
        return;
    }
    
    if (newPassword.length < 4) {
        showError('新密碼長度至少為4位');
        document.getElementById('newPasswordInput').focus();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('密碼更新成功！');
            closeChangePasswordModal();
        } else {
            showError(data.error || '密碼更新失敗');
        }
    } catch (error) {
        showError('網路錯誤，請檢查連線：' + error.message);
        console.error('Change password error:', error);
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    // 首先初始化階段系統（其他功能可能依賴它）
    initializeStages();
    initializeRanking();
});
