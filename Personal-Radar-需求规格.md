# Personal Radar 需求规格

> 状态：冻结版（精简首版）  
> 目标平台：Windows 10/11、Chrome/Edge  
> 默认地址：`http://127.0.0.1:3210`  
> 产品定位：本地运行的信息收藏、关注对象管理和 AI 总结工具

## 1. 首版目标

Personal Radar 首版只解决四件事：收藏方便、分类方便、总结有用、数据不会丢。它是个人自用工具，源码可公开到 GitHub，但个人数据和配置只保存在本机。

页面可以响应式布局，但首版只保证 Windows 电脑浏览器使用，不支持手机跨设备访问。

## 2. 三个核心闭环

### 2.1 每日情报

1. 创建关注对象并添加关键词和信息源；
2. 用户点击“生成今日情报”；
3. 应用读取公开 URL，或提示用户通过扩展主动采集页面；
4. AI 对采集内容分类和总结；
5. 用户收藏重要内容。

首版采用按钮触发，不追求无人值守自动化，不模拟登录、不处理验证码、不绕过平台限制。

### 2.2 自由收藏

扩展只在用户主动点击时执行：

- 收藏当前页面；
- 保存用户主动选择的文字；
- 保存标题、URL 和正文摘要；
- 选择一个关注对象；
- 将内容交回本地应用分类和总结。

首版不持续监控浏览历史，不记录心跳、停留时间或播放比例，不读取 Cookie、密码、请求头、表单、剪贴板、私信或支付页面，也不在隐身窗口运行。

### 2.3 简单画像

画像只根据用户主动收藏并确认的内容生成：

- 当前关注主题；
- 最近兴趣变化；
- 学习或工作方向；
- 推荐关键词。

所有结果均为待确认建议，确认后才保存。首版不分析性格、生活状态、健康、政治、宗教、性取向等敏感属性。

## 3. 技术结构

```text
personal-radar/
├─ app/          # Next.js 页面和 API
├─ extension/    # Chrome/Edge Manifest V3 扩展
├─ drizzle/      # SQLite Schema 与 migration
├─ scripts/      # Windows 启动、导入和导出
├─ docs/
├─ .data/        # 个人数据，不提交 Git
└─ .env.local    # AI 配置，不提交 Git
```

固定技术栈：Next.js、TypeScript、Tailwind CSS、SQLite、Drizzle、Chrome Extension。首版不使用 monorepo、独立 worker、复杂持久化队列、插件框架或运行时多 Agent。

Windows 本机若已通过 CCSwitch 配置 Claude Code，应用优先只读 `%USERPROFILE%\.claude\settings.json` 中的 Claude 服务地址、认证令牌和模型名，不复制或回显密钥；`.env.local` 作为兼容回退。

## 4. 数据模型

### 4.1 关注对象与关键词

- `watch_targets`：名称、说明、启用状态、创建和更新时间；
- `keywords`：所属对象、显示值、规范化值、启用状态、来源和时间；
- 同一关注对象中的规范化关键词唯一；
- 规范化使用 Unicode NFKC、小写、首尾空白清理和连续空白折叠；
- 停用关键词保留历史，不由 AI 自动重新启用。

### 4.2 信息源与收藏

- `sources`：所属对象、名称、公开 URL、类型、启用状态；
- `saved_items`：所属对象、标题、URL、正文摘要、用户选文、AI 摘要、时间；
- `daily_reports` 和 `daily_report_items`：手动生成的今日情报及条目关系；
- `profile_suggestions`：基于已确认收藏生成的待确认建议。

数据库时间统一保存 UTC。业务日期使用 `APP_TIMEZONE`，默认 `Asia/Shanghai`。

## 5. 页面与 API

主要页面：

- 首页；
- 关注对象详情与关键词管理；
- 收藏列表；
- 今日情报；
- 简单画像建议；
- 设置与数据导入导出。

首页提供快速搜索框，并允许从必应或百度中选择默认搜索引擎。关注对象可使用当前启用关键词一键搜索。首版搜索在新标签页打开，不抓取或持久化搜索结果。

首版核心接口：

```text
GET    /api/watch-targets
POST   /api/watch-targets
GET    /api/watch-targets/:id
PATCH  /api/watch-targets/:id
POST   /api/watch-targets/:id/keywords
PATCH  /api/keywords/:id

POST   /api/saved-items
POST   /api/daily-reports
GET    /api/daily-reports/:id

POST   /api/profile-suggestions/generate
POST   /api/profile-suggestions/:id/confirm

POST   /api/export
POST   /api/import
```

所有写接口使用 Zod 校验。普通耗时操作可在请求内显示进度或返回明确错误；首版不建设通用任务调度平台。

## 6. 本地安全边界

- Web 只监听 `127.0.0.1:3210`；
- `.data/`、`.env.local`、备份、日志和扩展本地状态不提交 Git；
- API Key 优先从本机 CCSwitch/Claude Code 配置只读获取，或从 `.env.local` 回退读取；不写数据库、不回显、不进入导出；
- 扩展固定权限仅为 `activeTab`、`scripting`、`storage` 和本地应用地址；网站访问由用户主动点击触发；
- 导出不包含 API Key、Cookie、登录信息或扩展权限；
- GitHub Actions 只使用虚构测试数据和空白示例配置。

DPAPI、字段级 AES、HMAC 去重、全字段加密和分块备份不属于精简首版。

## 7. 数据导出与恢复

首版导出包含：

```text
.data/database.sqlite
.data/library/
config.json
```

默认生成 `personal-radar-backup.zip`，明确排除 `.env.local` 和 API Key。恢复只允许导入结构有效的备份；导入前创建当前数据的本地安全副本，失败时恢复原数据。

`.pradar`、密码加密归档和跨多代 Schema 自动恢复留待后续版本。

## 8. 实施顺序

1. 关注对象、关键词和 SQLite；
2. 手动粘贴网页 URL、获取正文和 AI 总结；
3. 浏览器扩展一键收藏当前网页；
4. 今日情报页面；
5. 根据收藏生成兴趣变化和关键词建议；
6. ZIP 数据导出和导入；
7. README、Windows 脚本、GitHub Actions 和公开仓库检查。

每一步独立验收，不为了未来功能提前建设复杂基础设施。

## 9. 首步验收标准

- 可以创建、查看和编辑关注对象；
- 创建对象时可同时创建一个或多个关键词；
- 关键词规范化后不会在同一对象中重复；
- 可以启用或停用关键词，历史记录保留；
- 数据写入 `.data/database.sqlite`，重启应用后仍存在；
- 应用只监听 `127.0.0.1:3210`；
- `.data/` 和 `.env.local` 不会进入 Git；
- typecheck、migration 测试和生产构建通过。
