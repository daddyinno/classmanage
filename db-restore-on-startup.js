#!/usr/bin/env node

/**
 * 啟動時數據庫還原腳本
 * 解決 Render 部署時 SQLite 文件丟失的問題
 */

const fs = require('fs');
const path = require('path');
const backup = require('./backup');

// 數據庫還原功能
class DatabaseRestoreManager {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, 'classroom.db');
        this.backupDir = path.join(__dirname, 'backups');
        this.remoteBackupUrl = process.env.REMOTE_BACKUP_URL; // 可選：遠程備份位置
    }

    // 檢查數據庫是否存在且有效
    async isDatabaseValid() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                console.log('⚠️  數據庫文件不存在');
                return false;
            }

            const stats = fs.statSync(this.dbPath);
            if (stats.size === 0) {
                console.log('⚠️  數據庫文件為空');
                return false;
            }

            // 檢查是否為有效的 SQLite 文件
            const buffer = fs.readFileSync(this.dbPath, { start: 0, end: 15 });
            const header = buffer.toString('ascii', 0, 15);
            
            if (!header.startsWith('SQLite format 3')) {
                console.log('⚠️  不是有效的 SQLite 文件');
                return false;
            }

            console.log('✅ 數據庫文件有效');
            return true;
        } catch (error) {
            console.error('❌ 檢查數據庫時出錯:', error.message);
            return false;
        }
    }

    // 從本地備份還原
    async restoreFromLocalBackup() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                console.log('📁 備份目錄不存在，創建新目錄');
                return false;
            }

            const backupFiles = fs.readdirSync(this.backupDir)
                .filter(file => file.endsWith('.db'))
                .sort((a, b) => b.localeCompare(a)); // 按時間排序，最新的在前

            if (backupFiles.length === 0) {
                console.log('📂 沒有找到本地備份文件');
                return false;
            }

            const latestBackup = path.join(this.backupDir, backupFiles[0]);
            console.log(`🔄 從本地備份還原: ${backupFiles[0]}`);

            // 複製備份文件到主數據庫位置
            fs.copyFileSync(latestBackup, this.dbPath);
            
            console.log('✅ 本地備份還原成功');
            return true;
        } catch (error) {
            console.error('❌ 從本地備份還原失敗:', error.message);
            return false;
        }
    }

    // 從遠程還原（GitHub、雲端存儲等）
    async restoreFromRemote() {
        try {
            if (!this.remoteBackupUrl) {
                console.log('🌐 未配置遠程備份URL');
                return false;
            }

            console.log('🌐 嘗試從遠程還原...');
            // 這裡可以實現從 GitHub、S3 等下載最新備份
            // 暫時返回 false，可以後續擴展
            return false;
        } catch (error) {
            console.error('❌ 從遠程還原失敗:', error.message);
            return false;
        }
    }

    // 創建基礎數據庫結構
    async createFreshDatabase() {
        try {
            console.log('🆕 創建新的數據庫...');
            
            // 刪除可能存在的損壞文件
            if (fs.existsSync(this.dbPath)) {
                fs.unlinkSync(this.dbPath);
            }

            // 初始化數據庫（會觸發 database.js 中的初始化）
            const database = require('./database');
            await new Promise((resolve) => {
                setTimeout(resolve, 1000); // 給數據庫初始化一些時間
            });

            console.log('✅ 新數據庫創建完成');
            return true;
        } catch (error) {
            console.error('❌ 創建新數據庫失敗:', error.message);
            return false;
        }
    }

    // 主要還原流程
    async restoreDatabase() {
        console.log('🔍 檢查數據庫狀態...');

        // 1. 檢查當前數據庫是否有效
        if (await this.isDatabaseValid()) {
            console.log('✅ 當前數據庫正常，無需還原');
            return true;
        }

        console.log('🚨 檢測到數據庫問題，開始還原流程...');

        // 2. 嘗試從本地備份還原
        if (await this.restoreFromLocalBackup()) {
            if (await this.isDatabaseValid()) {
                console.log('✅ 本地備份還原成功');
                return true;
            }
        }

        // 3. 嘗試從遠程還原
        if (await this.restoreFromRemote()) {
            if (await this.isDatabaseValid()) {
                console.log('✅ 遠程備份還原成功');
                return true;
            }
        }

        // 4. 創建新數據庫
        console.log('⚠️  所有還原嘗試失敗，創建新數據庫');
        return await this.createFreshDatabase();
    }

    // 啟動後立即執行備份（保護新數據）
    async performStartupBackup() {
        try {
            console.log('💾 執行啟動備份...');
            
            backup.performBackup('local', (err, result) => {
                if (err) {
                    console.error('❌ 啟動備份失敗:', err.message);
                } else {
                    console.log('✅ 啟動備份完成:', result.backupFile);
                }
            });
        } catch (error) {
            console.error('❌ 啟動備份錯誤:', error.message);
        }
    }
}

// 導出管理器
module.exports = DatabaseRestoreManager;

// 如果直接運行此腳本
if (require.main === module) {
    const restoreManager = new DatabaseRestoreManager();
    
    restoreManager.restoreDatabase()
        .then(success => {
            if (success) {
                console.log('🎉 數據庫還原流程完成');
                
                // 執行啟動備份
                setTimeout(() => {
                    restoreManager.performStartupBackup();
                }, 2000);
            } else {
                console.error('💥 數據庫還原失敗');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 還原過程出錯:', error.message);
            process.exit(1);
        });
}
