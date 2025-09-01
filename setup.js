#!/usr/bin/env node

/**
 * 班級管理系統安裝和配置腳本
 * 自動化設置環境、依賴和配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 開始設置班級管理系統...\n');

// 檢查 Node.js 版本
function checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    console.log(`📋 Node.js 版本: ${nodeVersion}`);
    
    if (majorVersion < 18) {
        console.error('❌ 需要 Node.js 18 或更高版本');
        process.exit(1);
    }
    console.log('✅ Node.js 版本符合要求\n');
}

// 安裝依賴
function installDependencies() {
    console.log('📦 安裝依賴套件...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ 依賴安裝完成\n');
    } catch (error) {
        console.error('❌ 依賴安裝失敗:', error.message);
        process.exit(1);
    }
}

// 創建環境配置文件
function createEnvFile() {
    const envPath = '.env';
    const envExamplePath = 'env.example';
    
    if (fs.existsSync(envPath)) {
        console.log('⚠️  .env 文件已存在，跳過創建');
        return;
    }
    
    if (!fs.existsSync(envExamplePath)) {
        console.log('⚠️  env.example 文件不存在，跳過 .env 創建');
        return;
    }
    
    console.log('📝 創建環境配置文件...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env 文件已創建\n');
}

// 創建必要的目錄
function createDirectories() {
    console.log('📁 創建必要目錄...');
    
    const directories = [
        'data',      // 數據庫文件
        'backups',   // 備份文件
        'logs'       // 日誌文件
    ];
    
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`  ✅ 創建目錄: ${dir}`);
        } else {
            console.log(`  📁 目錄已存在: ${dir}`);
        }
    });
    console.log('');
}

// 初始化數據庫
function initializeDatabase() {
    console.log('🗄️  初始化數據庫...');
    try {
        const database = require('./database');
        database.initializeDatabase();
        console.log('✅ 數據庫初始化完成\n');
    } catch (error) {
        console.error('❌ 數據庫初始化失敗:', error.message);
        process.exit(1);
    }
}

// 測試系統
function testSystem() {
    console.log('🧪 測試系統功能...');
    
    try {
        // 測試數據庫連接
        const database = require('./database');
        database.getAllStudents((err, students) => {
            if (err) {
                throw new Error('數據庫連接失敗: ' + err.message);
            }
            console.log('  ✅ 數據庫連接正常');
            
            // 測試備份功能
            const backup = require('./backup');
            backup.checkDatabaseIntegrity().then(isOk => {
                if (isOk) {
                    console.log('  ✅ 數據庫完整性檢查通過');
                } else {
                    console.log('  ⚠️  數據庫完整性檢查警告');
                }
                
                console.log('✅ 系統測試完成\n');
                showCompletionMessage();
            });
        });
    } catch (error) {
        console.error('❌ 系統測試失敗:', error.message);
        process.exit(1);
    }
}

// 顯示完成訊息
function showCompletionMessage() {
    console.log('🎉 班級管理系統設置完成！\n');
    
    console.log('📋 下一步操作:');
    console.log('  1. 修改 .env 文件設置你的配置');
    console.log('  2. 運行 npm start 啟動系統');
    console.log('  3. 訪問 http://localhost:3000 開始使用\n');
    
    console.log('💾 備份操作:');
    console.log('  - 立即備份: npm run backup');
    console.log('  - 查看備份: npm run backup:list');
    console.log('  - 設置定時備份: npm run setup:cron\n');
    
    console.log('🚀 部署選項:');
    console.log('  - Railway: 使用 railway.toml 配置文件');
    console.log('  - Docker: docker-compose up -d');
    console.log('  - 手動部署: 參考 DEPLOYMENT.md\n');
    
    console.log('📚 更多信息請查看 DEPLOYMENT.md 和 README.md');
}

// 主函數
function main() {
    try {
        checkNodeVersion();
        installDependencies();
        createEnvFile();
        createDirectories();
        initializeDatabase();
        testSystem();
    } catch (error) {
        console.error('❌ 設置失敗:', error.message);
        process.exit(1);
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    main();
}

module.exports = {
    checkNodeVersion,
    installDependencies,
    createEnvFile,
    createDirectories,
    initializeDatabase,
    testSystem
};

