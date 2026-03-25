# aiToFuture

AI 多模态生成平台（文生图、图生图、文生视频、文生语音）项目骨架。

## 已实现能力
- 用户注册/登录（JWT + Cookie）
- 积分扣减与流水记录
- 生成任务记录入库（MySQL）
- 生成结果落本地文件并可访问
- MiniMax 适配层预留（当前默认 mock）

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
