# Personal Radar

> **信息时代，渠道为王。掌握自己的信息获取渠道。**

Personal Radar 是一个面向 Windows 10/11 的本地情报工作台。它把关注对象、关键词、精品渠道、主动采集内容、AI 摘要、今日情报和备份恢复放在同一个中文界面中，帮助用户建立由自己维护的信息获取渠道。

应用仅监听 `http://127.0.0.1:3210`，个人数据默认保存在本机 SQLite。公开仓库不包含任何预设关注对象、真实渠道、个人数据、AI 服务地址或密钥。

## 功能

- 管理关注对象、关键词和网站范围。
- “雷达工作台”和“自由浏览”两个独立入口，点击后切换对应界面。
- 粘贴公开 URL 提取正文，或通过 Chrome/Edge 扩展主动收录当前页面与选中文字。
- 优先复用本机 CCSwitch/Claude Code 配置生成摘要、今日情报草稿和画像建议。
- 今日情报只使用所选业务日期当天的主动采集内容，确认后才写入数据库。
- 简单画像只使用已确认日报条目；敏感属性由服务端过滤，建议逐条确认后保存。
- ZIP 导出与安全恢复：SQLite 一致性快照、资料库、路径与大小校验、导入前安全副本和失败恢复。
- 可选的 Personal Radar Research Skill：按“精品渠道 → 主流定调 → 随机小众挖掘”执行一次用户主动触发的调研。

Personal Radar 不后台抓取，不模拟登录，不读取 Cookie、密码、浏览历史、请求头、表单、私信或支付信息。AI 或网页访问失败时显示真实错误，不伪造结果。

## Windows 10/11 安装

### 环境要求

- Windows 10 或 Windows 11
- Node.js 24
- npm 11 或兼容版本
- Chrome 或 Edge（加载扩展时需要）

将仓库克隆或下载到当前用户有写入权限的目录，在项目目录打开 PowerShell 或 Windows Terminal：

```powershell
.\setup-windows.cmd
```

脚本会检查 Node.js、npm 和锁文件，执行 `npm.cmd ci`、数据库 migration 与生产构建。首次运行会创建被 Git 忽略的 `.data/database.sqlite`，其中没有预设关注对象或个人数据。

安装完成后启动：

```powershell
.\start-personal-radar.cmd
```

浏览器打开 <http://127.0.0.1:3210>。保持命令窗口运行；停止时按 `Ctrl+C`。

两个脚本都不会把服务改为局域网或公网监听，也不会删除已有 `.data`、`.env.local` 或导入安全副本。

## 升级与迁移

升级前先在页面的“数据与恢复”区域导出 ZIP 备份，然后停止 Personal Radar。

- Git 更新：拉取新版本后再次运行 `setup-windows.cmd`。
- 压缩包更新：保留旧目录中的 `.data/` 与 `.env.local`，替换源码后运行新版安装脚本。
- 更换电脑：在旧电脑导出 ZIP；在新电脑安装、启动后，从“数据与恢复”导入该 ZIP。

Migration 是幂等的，不会把已有数据库重新初始化。AI 配置、Cookie、登录凭据和扩展本地状态不进入备份，需要在新电脑单独配置。

## AI 配置

应用优先只读使用本机已有的 CCSwitch/Claude Code 配置：

```text
%USERPROFILE%\.claude\settings.json
```

只读取兼容的服务地址、认证字段和模型名；密钥不会回显、写入 SQLite、复制到项目目录或进入备份。

没有使用 CCSwitch 时，可创建本机回退配置：

```powershell
Copy-Item .env.example .env.local
```

```text
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
APP_TIMEZONE=Asia/Shanghai
```

仓库中的 `.env.example` 故意保持 AI 字段为空。不要把 `.env.local` 提交到 Git。

## 加载 Chrome/Edge 扩展

1. 启动 Personal Radar。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 启用“开发者模式”。
4. 点击“加载已解压的扩展”，选择仓库中的 `extension` 目录。
5. 在普通、非隐身窗口打开要收录的具体页面。
6. 如需保存选文，先选择页面文字。
7. 点击 Personal Radar 扩展，选择关注对象，再点击“收录到 Personal Radar”。
8. 返回工作台刷新，在保存前核对来源与内容。

扩展权限严格限定为：

- `activeTab`
- `scripting`
- `http://127.0.0.1:3210/*`

扩展不申请 `cookies`、`webRequest`、`history`、`<all_urls>` 或隐身运行权限。脚本仅在用户点击后执行一次。

## 安装调研 Skill

仓库中的 `skills/personal-radar-research` 是空白渠道版个人 Skill，不包含任何真实关注对象或精品链接。

安装到当前 Windows 用户：

```powershell
$target = Join-Path $env:USERPROFILE ".codex\skills\personal-radar-research"
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
Copy-Item ".\skills\personal-radar-research" $target -Recurse -Force
```

重新打开 Codex 后，可以调用：

```text
使用 $personal-radar-research 调研我的关注对象
```

一次调用只执行一轮只读流水线：

1. 读取用户确认的精品渠道。
2. 在主流平台和权威来源中确定公开叙事。
3. 从 3–7 个安全、不同域名的小众来源中随机抽取一个进行挖掘。

Skill 结束报告后立即停止。未调用时不会研究，不创建后台监控、轮询器、队列、定时任务或常驻 Agent。新渠道和内容只有在用户明确确认后才会写入。

精品渠道配置模板位于 `skills/personal-radar-research/references/curated-sources.md`。

## 备份与恢复

“数据与恢复”可导出 `personal-radar-backup.zip`，归档只包含：

```text
.data/database.sqlite
.data/library/
config.json
```

SQLite 使用在线备份 API 生成一致性快照。导入会拒绝路径穿越、额外或重复文件、超限归档、损坏数据库、缺失表和外键错误；替换前会在 `.data/import-safety/` 创建安全副本，失败时自动恢复。

备份 ZIP 包含个人情报，只应存放在自己控制的位置，不要上传到公开仓库。

## 本地开发与验证

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

提交前运行：

```powershell
npm.cmd run repo:check
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --omit=dev
```

GitHub Actions 使用 Windows、Node.js 24、空白 AI 环境变量、临时 SQLite 路径和虚构测试数据，执行依赖安装、公开仓库安全检查、生产依赖审计、migration、测试、类型检查和生产构建。

## 公开仓库安全边界

以下内容始终留在本机：

- `.data/`、SQLite/WAL/SHM 和资料库
- `.env`、`.env.local` 等本机配置；只允许空白 `.env.example`
- ZIP 备份、导出目录、日志和导入安全副本
- 扩展本地状态
- `.npmrc`、私钥、证书、凭据和 secrets 文件

`.gitignore` 与 `npm.cmd run repo:check` 会检查这些路径、常见密钥格式、绝对用户路径、扩展权限、Windows 脚本和本机监听地址。忽略规则不能移除已经被 Git 跟踪的敏感文件，因此每次发布前仍应检查 `git status --short`。

## 项目结构

```text
app/          Next.js 页面与本地 API
components/   中文磨砂玻璃界面组件
drizzle/      SQLite Schema 与 migration
extension/    Chrome/Edge Manifest V3 主动采集扩展
lib/          业务逻辑、安全校验与 AI 适配
skills/       可选的 Personal Radar Research Skill
tests/        虚构数据测试
docs/         架构与任务记录
```

冻结的首版需求见 `Personal-Radar-需求规格.md`，实现架构见 `docs/architecture.md`。
