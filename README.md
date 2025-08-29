# 班房管理系统 - 养成游戏 🎮

一个类似 ClassDojo 的班级管理系统，结合了养成游戏元素，让班级管理变得更加有趣和激励人心！

## ✨ 特色功能

### 🎯 养成游戏系统
- **三阶段进化**：每个学生从蛋🥚开始，逐步进化到幼体🐣，最终成为完全体🦋
- **积分驱动成长**：
  - 🥚 蛋阶段：0-49分
  - 🐣 幼体阶段：50-199分  
  - 🦋 完全体阶段：200分以上

### 📊 积分管理
- **个人操作**：为单个学生快速加减 1/5/10/20 分
- **全班操作**：一键为全班同学统一加减分
- **积分记录**：完整的积分变化历史，包含时间、原因等详细信息

### 👥 班级管理
- **学生管理**：添加/删除学生，查看详细信息
- **实时更新**：积分变化实时反映在界面上
- **美观界面**：现代化设计，支持响应式布局

## 🚀 快速开始

### 环境要求
- Node.js 14+ 
- NPM 或 Yarn

### 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动服务器**
   ```bash
   npm start
   ```
   
   或使用开发模式（自动重启）：
   ```bash
   npm run dev
   ```

3. **访问系统**
   打开浏览器访问：`http://localhost:3000`

## 🛠️ 技术架构

### 后端技术栈
- **Node.js + Express.js**：轻量级Web服务器
- **SQLite**：嵌入式数据库，无需额外配置
- **RESTful API**：标准化的接口设计

### 前端技术栈
- **原生HTML/CSS/JavaScript**：无框架依赖，易于部署
- **响应式设计**：支持手机、平板、电脑访问
- **现代化UI**：渐变色彩、流畅动画、友好交互

### 数据库设计
- `students` 表：存储学生基本信息和积分状态
- `point_logs` 表：记录所有积分变化历史
- `evolution_config` 表：配置进化阶段规则

## 📱 使用说明

### 添加学生
1. 在顶部输入框中输入学生姓名
2. 点击"➕ 添加学生"按钮或按回车键
3. 新学生将以蛋🥚阶段和0分开始

### 积分操作
- **个人加减分**：点击学生卡片上的 +1、+5、-1、-5 按钮
- **批量操作**：使用顶部的"全班 +1/+5/-1/-5"按钮
- **详细操作**：点击"详情"查看学生信息，进行更大幅度的积分调整

### 查看进化
- 学生积分达到阶段要求时会自动进化
- 卡片颜色和图标会根据阶段变化
- 进度文本显示距离下一阶段还需多少分

### 历史记录
- 底部显示最近的积分变化记录
- 包含学生姓名、分数变化、操作原因和时间
- 支持手动刷新和清空显示

## 🌐 部署建议

### 本地部署
适合小型班级或个人使用：
```bash
npm start
```

### 云服务器部署
1. **VPS/云主机**：上传代码，安装Node.js，运行应用
2. **Heroku**：支持一键部署，免费套餐可用
3. **Vercel/Netlify**：适合前端部分，需要额外的数据库服务

### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 自定义配置

### 修改进化阶段
编辑 `database.js` 中的进化配置：
```javascript
// 修改积分阶段要求
db.run(`INSERT OR REPLACE INTO evolution_config (id, stage, min_points, max_points, description) VALUES
    (1, 'egg', 0, 49, '蛋阶段 - 刚开始的状态'),
    (2, 'baby', 50, 199, '幼体阶段 - 开始成长'),  
    (3, 'character', 200, 999999, '完全体阶段 - 成熟角色')
`);
```

### 修改角色图标
编辑 `public/script.js` 中的 `STAGE_CONFIG`：
```javascript
const STAGE_CONFIG = {
    egg: { emoji: '🥚', name: '蛋阶段', min: 0, max: 49 },
    baby: { emoji: '🐣', name: '幼体阶段', min: 50, max: 199 },
    character: { emoji: '🦋', name: '完全体阶段', min: 200, max: 999999 }
};
```

### 修改界面主题
编辑 `public/styles.css` 中的颜色变量和渐变效果。

## 📋 API接口

### 学生管理
- `GET /api/students` - 获取所有学生
- `POST /api/students` - 添加学生
- `DELETE /api/students/:id` - 删除学生

### 积分管理  
- `POST /api/students/:id/points` - 调整单个学生积分
- `POST /api/students/all/points` - 批量调整全班积分

### 记录查询
- `GET /api/logs` - 获取所有积分记录
- `GET /api/logs/:studentId` - 获取特定学生的记录

### 系统信息
- `GET /api/stages` - 获取进化阶段配置

## 🎨 界面预览

系统包含以下主要界面：
- **班级概览**：显示所有学生的当前状态和积分
- **学生卡片**：展示个人进化阶段和快速操作按钮
- **积分记录**：历史操作的完整日志
- **学生详情**：个人信息和高级操作界面

## 🤝 贡献指南

欢迎提交问题报告和功能建议！

### 开发环境设置
1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/新功能`
3. 提交变更：`git commit -am '添加新功能'`
4. 推送分支：`git push origin feature/新功能`
5. 提交Pull Request

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🙋‍♂️ 支持

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件到项目维护者

---

**让班级管理变得更有趣！** 🚀✨
