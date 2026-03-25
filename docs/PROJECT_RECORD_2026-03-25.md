# 项目阶段记录（2026-03-25）

## 版本阶段
- 项目：`aiToFuture`
- 记录时间：2026-03-25（Asia/Shanghai）
- 阶段目标：打通模型选择、多模态生成工作台、登录态交互、部署与安全基础能力。

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

### 2. 数据库与脚本
- 初始化脚本扩展：`scripts/init_db.sql`
  - 增加 `ai_models` 表。
  - 增加生成任务模型字段。
  - 写入默认模型与费用规则。
- 新增迁移脚本：`scripts/migrate_add_models.sql`。

### 3. 前端交互与页面
- 工作台能力：
  - 能力类型选择、模型选择、Prompt 快捷模板、积分预估展示。
  - 图生图文件上传联动。
  - 历史记录/积分流水展示。
- 登录态交互（当前最终方案）：
  - 访问首页默认直接显示工作台。
  - 未登录可浏览并填写参数。
  - 点击“提交生成/刷新模型”等需鉴权动作时弹出登录层。
  - 登录成功后无缝刷新状态并继续使用。

### 4. 运维与启动
- 新增脚本：
  - `scripts/start.sh`
  - `scripts/stop.sh`
  - `scripts/restart.sh`
- 新增安全扫描脚本：`scripts/check-secrets.sh`
  - 对已跟踪文件执行敏感信息扫描。
  - `npm run security:check` 可直接执行。
- `.gitignore` 强化：忽略 `.env.*`（保留 `.env.example`）、`*.pid`、日志文件。

### 5. 服务器侧执行记录（非仓库文件）
- 服务运行：`aiToFuture` 已可在 `http://127.0.0.1:4002` 访问。
- systemd：已部署并启用 `aitofuture.service`（开机自启）。
- 数据库：已创建独立库 `aitofuture`。
- 权限：
  - `lincolning`：`aitofuture` 只读。
  - `readonly_client`：`aitofuture` 只读。

## 当前已知说明
- 由于 `lincolning` 为只读，`scripts/start.sh` 中数据库初始化会提示权限不足并跳过；不影响服务启动。
- 若后续需要在线迁移或自动建表，建议单独配置一个受控写权限账号（仅对 `aitofuture`）。

## 下阶段建议
- 增加管理员模型管理页面（启停模型、默认模型切换、单模型计费调整）。
- 增加登录态缓存提示与会话超时引导。
- 增加前端 E2E 回归测试（登录、提交、未登录拦截）。
