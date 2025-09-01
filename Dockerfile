# 使用官方 Node.js 18 鏡像
FROM node:18-alpine

# 設置工作目錄
WORKDIR /app

# 安裝 SQLite
RUN apk add --no-cache sqlite

# 複製 package 文件
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製應用代碼
COPY . .

# 創建必要的目錄
RUN mkdir -p /app/data /app/backups /app/logs

# 設置數據庫文件路徑
ENV DB_PATH=/app/data/classroom.db

# 設置適當的權限
RUN chown -R node:node /app
USER node

# 暴露端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# 啟動應用
CMD ["npm", "start"]



