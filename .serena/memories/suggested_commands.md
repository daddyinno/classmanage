# 班房管理系统 - 建议命令

## 开发环境启动
```bash
# 安装依赖
npm install

# 启动开发服务器（自动重启）
npm run dev

# 启动生产服务器
npm start
```

## 系统操作
```bash
# 查看系统状态
npm run db:check

# 备份数据库
npm run backup:local

# 恢复数据库
npm run backup:restore

# 测试邮件配置
npm run email:test
```

## 项目管理
```bash
# 查看所有学生
GET /api/students

# 清空所有学生记录（慎用！）
POST /api/students/reset-all
```

## 部署命令
```bash
# 设置定时备份
npm run setup:cron

# 检查备份状态
npm run backup:check
```