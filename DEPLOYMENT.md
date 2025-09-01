# 部署說明

## 子文件夾部署

如果需要將此項目部署到服務器的子文件夾（例如 `https://yourdomain.com/classmanage/`），請按照以下步驟：

### 1. 設置環境變數

創建 `.env` 檔案或在啟動時設置環境變數：

```bash
# 部署到子文件夾
BASE_PATH=/classmanage PORT=3000 node server.js

# 或者設置 .env 檔案
echo "BASE_PATH=/classmanage" > .env
echo "PORT=3000" >> .env
npm start
```

### 2. 部署結構

部署後的文件結構應該像這樣：

```
服務器根目錄/
└── classmanage/          # 你的子文件夾
    ├── server.js
    ├── database.js
    ├── package.json
    ├── public/
    │   ├── index.html
    │   ├── script.js
    │   └── styles.css
    └── classroom.db
```

### 3. Web服务器配置

#### Apache (.htaccess)
```apache
RewriteEngine On
RewriteRule ^classmanage/api/(.*)$ classmanage/server.js/$1 [L,P]
```

#### Nginx
```nginx
location /classmanage/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. 訪問地址

- 本地開發: `http://localhost:3000`
- 子文件夾部署: `https://yourdomain.com/classmanage/`

系統會自動檢測當前環境並設置正確的API路徑。
