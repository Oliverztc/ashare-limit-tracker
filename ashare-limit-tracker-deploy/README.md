# A股涨跌停追踪应用

这是一个可以直接部署的全栈项目：
- 前端：React + Vite
- 后端：FastAPI
- 数据：AkShare 涨停池 / 跌停池
- 部署：一个 Dockerfile，同时支持 Render / Railway

## 本地运行

### 1) 启动后端
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2) 启动前端
新开一个终端：
```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

打开 http://127.0.0.1:5173

## Docker 本地运行
在项目根目录执行：
```bash
docker build -t ashare-limit-tracker .
docker run -p 8000:8000 ashare-limit-tracker
```

打开 http://127.0.0.1:8000

## Render 部署
1. 把整个项目上传到 GitHub。
2. 注册并登录 Render。
3. 新建 Web Service。
4. 选择你的 GitHub 仓库。
5. Render 会自动识别根目录的 Dockerfile。
6. 部署完成后，访问 Render 分配给你的域名。

如果你想用 Blueprint，也可以让 Render 识别仓库内的 `render.yaml`。

## Railway 部署
1. 把整个项目上传到 GitHub。
2. 登录 Railway。
3. 选择 New Project -> Deploy from GitHub Repo。
4. 选择你的仓库。
5. Railway 会自动使用根目录 `Dockerfile` 构建并部署。
6. 部署成功后，在项目里生成公开域名即可访问。

## 常见问题
- 非交易日时，接口可能为空。
- 如果 AkShare 当天接口波动，前端会显示空榜单或错误提示。
- 金额字段已尽量统一为“亿”，后续可以再按你的偏好精修。
