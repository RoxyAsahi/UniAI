# CoAI (ChatNio) 二次开发指南

## 一、 项目概述
**CoAI** 是一个全栈的下一代 AIGC 商业解决方案。项目采用了“大前端 + 强中转后端”的架构，前端专注于美观的 UI 交互与多端适配，后端则专注于多模型渠道（Channel）的分发、负载均衡、计费鉴权以及用户管理。

---

## 二、 技术栈概览

### 前端技术栈 (`/app` 目录)
- **核心框架**: React 18, TypeScript, Vite
- **状态管理**: Redux Toolkit (结合 LocalForage 本地持久化)
- **UI & 样式**: Tailwind CSS, Radix UI (无头组件库), Tremor Charts, Less
- **路由**: React Router v6
- **Markdown 渲染**: React Markdown, Remark/Rehype 生态 (支持 LaTeX公式、Mermaid 图表)
- **跨端支持**: PWA (Progressive Web App), Tauri (用于打包桌面端)

### 后端技术栈 (根目录)
- **核心语言**: Golang (1.20+)
- **Web 框架**: Gin
- **数据库**: MySQL (持久化用户、对话、订阅记录), Redis (速率限制、缓存、鉴权令牌)
- **通信协议**: HTTP (RESTful / SSE 流式传输), WebSocket (前端对话通信)

---

## 三、 架构设计与核心目录拆解

### 1. 后端目录结构与核心模块
项目的核心在于对模型的解耦和渠道的流转调度。

```text
/adapter     # 协议适配层：负责将内部统一的请求格式，转换为对应模型（如 OpenAI, Claude, 智谱等）的真实 API 格式。
/auth        # 鉴权与计费层：负责用户注册登录、配额扣除 (Quota)、订阅判定 (Subscription)。
/channel     # 渠道调度层：核心调度中心！负责管理多渠道的优先级、权重、负载均衡、失败重试 (Ticker)。
/manager     # 业务逻辑层：处理 Chat 请求分发、模型分发、计费查询等核心业务入口。
/admin       # 后台管理层：提供给后台 Dashboard 的接口（数据分析、兑换码、渠道编辑等）。
/middleware  # 中间件：跨域处理(CORS)、IP限速(Throttle)、Token 鉴权拦截。
/connection  # 数据库连接：MySQL、Redis 的初始化和迁移脚本 (migration)。
/addition    # 扩展能力层：全网搜索(SearXNG)、文章生成等独立小模块。
```

#### 核心流转机制 (重要)
当一个用户发起 `Chat` 请求时，后端的生命周期流转如下：
1. **Manager**: `ChatHandler` 接收请求并解析参数。
2. **Auth**: `CanEnableModelWithSubscription` 校验用户是否有权限（额度、订阅组）使用该模型。
3. **Channel**: `NewChatRequestWithCache` 从渠道池中按优先级 (Priority) 和权重 (Weight) 选取出一个存活的 Channel。
4. **Adapter**: 调用选出的 Channel 对应的底层适配器发起真实网络请求。如果请求失败，交回 Channel 层触发重试策略。
5. **Manager**: 将返回的流式 (Stream) 数据通过 WebSocket 或 Server-Sent Events (SSE) 写入前端，并通过 `CollectQuota` 扣除用户 Token 额度。

### 2. 前端目录结构
前端是一个标准的 Vite + React 结构：

```text
/app/src
 ├── api/        # 统一的 Axios 接口请求封装
 ├── assets/     # 静态资源、全局 Less 变量
 ├── components/ # 通用 UI 组件 (如 Button, Dialog，基于 Radix 二次封装)
 ├── dialogs/    # 弹出层页面组件 (如设置面板、充值面板)
 ├── masks/      # 预设提示词 (Masks / Prompts) 管理
 ├── routes/     # 页面路由视图 (如 Chat 视图, Admin 视图)
 ├── store/      # Redux 状态切片 (Auth, Chat, Config)
 ├── translator/ # 国际化 i18n 脚本
 └── utils/      # 工具函数 (如设备判定、字符串截取)
```

---

## 四、 核心 API 接口清单
在二次开发时，如果需要对接第三方客户端或小程序，可参考以下核心接口（均在 `router.go` 中定义）：

### 1. 聊天与模型接口
- `GET /api/chat`: WebSocket 对话入口，接收对话上下文。
- `POST /api/v1/chat/completions`: OpenAI 标准兼容格式的对话接口 (HTTP SSE)。
- `POST /api/v1/images/generations`: OpenAI 标准兼容格式的绘图接口。
- `GET /api/v1/models`: 获取系统当前可用/支持的模型列表。
- `GET /api/v1/market`: 获取后台配置的模型市场标签与介绍。

### 2. 用户与鉴权 (`/api/auth`)
- `POST /api/login` & `POST /api/register`: 登录与注册。
- `GET /api/userinfo`: 获取用户基本信息、订阅状态。
- `GET /api/quota`: 获取当前用户的弹性点数额度。
- `POST /api/buy`: 点数支付/扣款接口。

### 3. 后台管理 (`/api/admin`)
- `GET /api/admin/channel/list`: 获取渠道列表。
- `POST /api/admin/channel/update/:id`: 更新特定渠道。
- `GET /api/admin/analytics/*`: 获取仪表盘（用量、异常、账单）统计数据。
- `POST /api/admin/user/quota`: 管理员修改用户额度。

---

## 五、 二次开发实战指导

### 实战 1：如何为后端添加一个新的大模型适配器 (Adapter)
如果您需要接入一个自家私有的模型，或者新的第三方模型厂商，按以下步骤操作：

1. **新建适配器文件**: 在 `adapter/` 目录下新建厂商文件夹，例如 `adapter/custom/`。
2. **实现请求逻辑**: 在新文件中定义构造请求的逻辑。
   - 必须实现构造目标 API 请求体（如转换 Message 格式）。
   - 处理 HTTP 响应，提取流式数据（Chunk）。
3. **注册适配器**: 修改 `adapter/request.go` 的 `NewChatRequest` 函数：
   ```go
   func NewChatRequest(channel *channel.Channel, props *ChatProps, hook globals.Hook) error {
       switch channel.GetType() {
       case globals.ChannelTypeCustom:  // 定义新的 ChannelType 常量
           return custom.NewChatRequest(channel, props, hook)
       // ...
       }
   }
   ```
4. **后台配置**: 重新编译运行后，前往管理员后台的「渠道管理」，新增一个渠道，此时就能选择你的 `Custom` 类型，并填入自定义模型的 API Key 和 Base URL。

### 实战 2：修改前端 UI 与配色
1. **修改全局样式**: 打开 `app/src/assets/globals.less`。你可以直接调整 `@primary`, `@background` 等 CSS 变量，立刻影响全站的主题颜色。
2. **修改组件库**: CoAI 深度依赖了 Tailwind CSS。如果你想更改输入框、按钮的圆角或边框，可以在 `app/src/components/` 下找到对应的组件（基于 Radix 构建），直接修改 `className` 中的 Tailwind 原子类即可。
3. **API 转发**: 处于开发环境时，`app/vite.config.ts` 已配置好了 `/api` 到 `http://localhost:8094` 的代理，无需担心跨域问题。

### 实战 3：修改计费逻辑
CoAI 的计费逻辑非常集中。如果需要开发特殊的“按月限制使用量”或者“VIP免费某模型”逻辑，修改核心文件：
- **`auth/quota.go`**：包含所有余额增加、扣除的 SQL 逻辑。
- **`manager/chat.go`** 里的 `ChatHandler`：控制每次对话结束后的额度扣除结算（`CollectQuota`）。
- 您可以在 `ChatHandler` 中根据 `user.Level` 加入 `if-else` 来劫持原有的扣费行为。

---

## 六、 本地开发与环境运行配置

### 1. 启动周边服务 (MySQL & Redis)
二开前请务必保证本地或服务器有 MySQL 和 Redis 实例运行，并在项目根目录的 `config.yaml` 或 `config/config.yaml` 中配置好连接信息：
```yaml
mysql:
  host: localhost
  port: 3306
  user: root
  password: yourpassword
  db: chatnio
redis:
  host: localhost
  port: 6379
```

### 2. 启动后端 (Golang)
```bash
# 切换到项目根目录
go mod tidy
go build -o chatnio
./chatnio
```
*启动成功后后端默认监听 `8094` 端口。*

### 3. 启动前端 (Vite)
```bash
cd app
# 推荐使用 pnpm
pnpm install
pnpm run dev
```
*启动后访问 `http://localhost:5173` 即可看到界面。*

### 4. 前后端分离部署提醒
- 打包前端：`cd app && pnpm run build`。将生成的 `dist` 目录扔给 Nginx。
- 配置后端环境变量：必须设置 `SERVE_STATIC=false`，这会告知后端不要抢占根路由的静态文件分发服务。

---

## 七、 数据库拓展注意事项
本项目使用了手动的 SQL 迁移系统（位于 `/migration` 目录）。如果您在二次开发中添加了新的数据表字段：
1. 您可以手动在您的 MySQL 实例中执行 `ALTER TABLE`。
2. 建议在 `/connection/db_migration.go` 中，增加对应版本的升级语句，以便未来将二开代码部署到生产环境时，系统能够自动完成表结构的更新。