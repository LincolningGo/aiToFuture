# ATF

AI 多模态生成平台（文生图、图生图、文生视频、文生语音）项目骨架。

## 已实现能力
- 用户注册/登录（JWT + Cookie）
- 积分扣减与流水记录
- 生成任务记录入库（MySQL）
- 生成结果落本地文件并可访问
- MiniMax 实际 API 适配（支持图像/视频/语音）

## 快速启动
1. 复制环境变量
```bash
cp .env.example .env
```

2. 初始化数据库
```bash
mysql -u root -p < scripts/init_db.sql
```

3. 安装并启动
```bash
npm install
npm run start
```

访问：`http://127.0.0.1:4002`

## MiniMax 配置说明
- 使用真实接口时设置：`AI_PROVIDER=minimax`。
- `MINIMAX_API_BASE` 默认是 `https://api.minimaxi.com`。
- 图生图会把输入图 URL 传给 MiniMax，`APP_BASE_URL` 需要可被 MiniMax 访问（公网可达域名）。

## 安全共享建议
- 不要共享 `.env`、日志、`*.pid` 等运行文件。
- 共享前执行：
```bash
npm run security:check
```
- 只提交 `.env.example`（占位符），不要提交真实密码。
