# UQA 学能诊断 — 独立项目

从 UniChat 主项目中剥离的独立学能诊断系统，包含完整的后端 API 服务和前端 Web 应用。

## 项目结构

```
uqa-standalone/
├── backend/          # Go 后端服务 (Gin + JWT + MySQL/SQLite)
│   ├── main.go
│   ├── go.mod
│   ├── config.example.yaml
│   ├── auth/         # JWT 解析与用户获取
│   ├── db/           # 数据库连接初始化
│   ├── globals/      # 公共 SQL 工具 & 日志
│   ├── middleware/   # CORS + Auth 中间件
│   └── uqa/          # 核心业务：types / service / controller / router
└── frontend/         # React 18 + Vite 5 + TypeScript 前端
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── App.tsx           # 路由配置
        ├── api/uqa.ts        # API 调用封装
        ├── utils/request.ts  # axios 实例（自动附加 JWT）
        └── pages/
            ├── UqaLanding.tsx        # 首页 + 历史记录
            ├── UqaQuestionnaire.tsx  # 52 题问卷（分维度分步）
            └── UqaResult.tsx         # 七维度得分报告
```

## 功能说明

- **52 道量表题**：覆盖 7 个维度，每题 1-5 分
- **3 道开放性问题**：家长填写孩子的优势、挑战与期望
- **七维度评分**：学习能量、情绪复原力、认知思维、行动习惯、信念系统、记忆表达、规则关系
- **区域判定**：优势区 / 发展区 / 预警区 / 风险区
- **历史记录**：查看所有历史诊断报告

## 快速启动

### 1. 后端

```bash
cd backend

# 复制配置文件
cp config.example.yaml config.yaml
# 编辑 config.yaml，填写数据库连接信息和 JWT 密钥

# 安装依赖
go mod tidy

# 启动服务（默认端口 8080）
go run main.go
```

**config.yaml 示例：**
```yaml
server:
  port: 8080

jwt:
  secret: "your-secret-key-here"

database:
  driver: sqlite          # 或 mysql
  dsn: "./uqa.db"         # SQLite 路径，或 MySQL DSN
```

### 2. 前端

```bash
cd frontend

# 安装依赖
npm install

# 开发模式（代理到 localhost:8080）
npm run dev

# 生产构建
npm run build
```

### 3. 认证说明

本项目复用主项目的 JWT 认证体系。前端需要将有效的 JWT token 存入 `localStorage`：

```js
localStorage.setItem('uqa_token', '<your-jwt-token>')
```

如需独立的登录系统，可在 `backend/auth/` 中添加登录接口，并在前端增加登录页面。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/uqa/assessments` | 提交诊断（需认证） |
| GET  | `/api/uqa/assessments` | 获取历史列表（需认证） |
| GET  | `/api/uqa/assessments/:id` | 获取诊断详情（需认证） |

### 提交诊断请求体

```json
{
  "answers": [3, 4, 2, ...],   // 52 个整数，每个 1-5
  "open_answers": ["...", "...", "..."]  // 3 个开放性回答
}
```

## 数据库表结构

```sql
CREATE TABLE uqa_assessments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  report      TEXT NOT NULL,   -- JSON: { scores_by_category, suggestions }
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端语言 | Go 1.21 |
| Web 框架 | Gin |
| 认证 | JWT (dgrijalva/jwt-go) |
| 数据库 | MySQL 或 SQLite（可切换） |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| HTTP 客户端 | axios |
| 路由 | react-router-dom v6 |
