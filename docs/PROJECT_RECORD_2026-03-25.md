# 项目阶段记录（2026-03-25）

## 版本阶段
- 项目：`ATF`
- 记录时间：2026-03-25（Asia/Shanghai）
- 阶段目标：打通模型选择、多模态生成工作台、登录态交互、MiniMax 真实能力接入、管理员权限基础能力。

## 本阶段完成项

### 1. 后端能力
- 新增模型查询接口：`GET /api/models/active`（需登录）。
- 生成接口支持 `modelCode` 参数：
  - `POST /api/generation/submit`
  - `POST /api/generation/submit-with-file`
- 生成服务增加模型解析与回填：
  - 写入 `generation_jobs.model_id/model_code/model_name`
  - 返回结果中包含模型信息。
- 参数校验增强：新增 `modelCode` 的类型与长度校验。

### 2. MiniMax 真实接口接入
- `src/services/provider/minimax-adapter.js` 从 scaffold 升级为真实适配：
  - 文生图 / 图生图：`POST /v1/image_generation`
  - 文生视频：`POST /v1/video_generation` + `GET /v1/query/video_generation` + `GET /v1/files/retrieve`
  - 文生语音：`POST /v1/t2a_v2`
- 增加网络错误、HTTP 错误、业务错误映射（`AppError`）。
- 增加图片/视频/音频下载与 MIME/扩展名推断。
- 修复文生图返回解析兼容问题：支持 `image_urls` 为字符串数组格式，避免“服务返回格式异常”。
- 图生图支持输入图 URL 透传；当 URL 可能为私网地址时自动回退 `data:image/...;base64`。

### 3. 用户与权限基础
- 新增用户角色字段：`users.role`（默认 `user`）。
- 登录 JWT 与鉴权上下文补充 `role`。
- `POST /api/auth/login`、`GET /api/user/me` 返回中补充 `role` 字段。
- 新增迁移脚本：`scripts/migrate_add_user_role.sql`。
- 已创建并验证超级管理员账号：`lincolning`（角色：`super_admin`）。

### 4. 数据库与脚本
- 初始化脚本扩展：`scripts/init_db.sql`
  - 增加 `ai_models` 表。
  - 增加生成任务模型字段。
  - 写入默认模型与费用规则。
  - `users` 表增加 `role` 字段。
- 迁移脚本：
  - `scripts/migrate_add_models.sql`
  - `scripts/migrate_add_user_role.sql`
- MiniMax 模型默认代码与官方命名对齐（脚本与配置同步更新）。

### 5. 前端交互与页面
- 工作台能力：
  - 能力类型选择、模型选择、Prompt 快捷模板、积分预估展示。
  - 图生图文件上传联动。
  - 历史记录/积分流水展示。
- 登录态交互（当前最终方案）：
  - 访问首页默认直接显示工作台。
  - 未登录可浏览并填写参数。
  - 点击“提交生成/刷新模型”等需鉴权动作时弹出登录层。
  - 登录成功后无缝刷新状态并继续使用。

### 6. 运维与启动
- 新增脚本：
  - `scripts/start.sh`
  - `scripts/stop.sh`
  - `scripts/restart.sh`
- 新增安全扫描脚本：`scripts/check-secrets.sh`
  - 对已跟踪文件执行敏感信息扫描。
  - `npm run security:check` 可直接执行。
- `.gitignore` 强化：忽略 `.env.*`（保留 `.env.example`）、`*.pid`、日志文件。

### 7. 服务器侧执行记录（非仓库文件）
- 服务运行：`ATF` 已可在 `http://127.0.0.1:4002` 访问。
- 数据库：已创建独立库 `aitofuture`。
- 当前权限基线：
  - `lincolning` 对 `aitofuture` 具备管理权限（用于当前阶段迁移与数据写入）。
  - `readonly_client` 对全库只读。

## 当前已知说明
- 目前管理员权限控制的“路由级拦截中间件”尚未落地；当前完成的是角色数据链路与超级管理员账号基线。
- 若后续进入生产，建议收敛数据库应用账号权限（按最小权限原则拆分读写账户）。

## 下阶段建议
- 增加管理员权限中间件（如 `requireRole('super_admin')`）与后台管理接口。
- 增加模型管理页面（启停模型、默认模型切换、单模型计费调整）。
- 增加前端 E2E 回归测试（登录、提交、未登录拦截、管理员权限校验）。

## 2026-03-25 补充（异步任务队列）
- 需求确认：所有生成能力（文生图、图生图、文生视频、文生语音）统一改为“提交即入队，异步出结果”。
- 后端实现：
  - `submitGeneration` 改为立即返回 `status=queued`。
  - 新增内存 worker 队列并发执行（默认并发 2，可通过 `GENERATION_QUEUE_CONCURRENCY` 调整）。
  - 状态流转：`queued -> processing -> completed/failed`。
  - 失败自动退还积分并记录流水。
- 前端实现：
  - 生成提交成功后不再宣称“立即完成”，改为“已进入队列”。
  - 历史记录存在 `queued/processing` 时自动轮询刷新，异步获取最新状态与产物链接。
  - 网络层对非 JSON 响应容错，避免直接提示“服务返回格式异常”。
- 配置优化：
  - MiniMax API 基址统一为 `https://api.minimaxi.com`。
  - 视频轮询默认上限提升到 120 次（`MINIMAX_VIDEO_POLL_MAX_ATTEMPTS`），减少长任务误判超时。
