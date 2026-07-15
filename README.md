# Personal Radar

> **信息时代，渠道为王。掌握自己的信息获取渠道。**

当前公开版本：**V1.2**（`1.2.0`）

Personal Radar 是一个面向 Windows 10/11 的本地情报工作台。它把关注对象、关键词、精品渠道、主动采集内容、AI 摘要、今日情报和备份恢复放在同一个中文界面中，帮助用户建立由自己维护的信息获取渠道。

应用仅监听 `http://127.0.0.1:3210`，个人数据默认保存在本机 SQLite。公开仓库不包含任何预设关注对象、真实渠道、个人数据、AI 服务地址或密钥。

## 功能

- 管理关注对象、关键词和网站范围。
- 在单一雷达工作台中管理关注、主动采集、日报、画像和备份。
- 粘贴公开 URL 提取正文，或通过 Chrome/Edge 扩展主动收录当前页面与选中文字。
- 优先复用本机 CCSwitch/Claude Code 配置生成摘要、今日情报草稿和画像建议。
- 今日情报只使用所选业务日期当天的主动采集内容，确认后才写入数据库。
- 简单画像同时参考用户明确填写的自我评价、目标/追求和已确认日报条目；每条建议说明证据及与目标的关系，逐条确认后才保存。
- ZIP 导出与安全恢复：SQLite 一致性快照、资料库、路径与大小校验、导入前安全副本和失败恢复。
- Personal Radar Codex 插件：每天早晨由用户明确调用后，按“热点维 → 官方维 → 补充维”完成一次公开信息研究。

V1.2 继续使用单一磨砂玻璃“雷达工作台”，不恢复“自由浏览”入口。日常浏览由用户在电脑或手机上完成；需要系统化研究时明确调用插件中的 Skill，看到值得保留的内容后再确认收录。应用本身不代替浏览器，也不在后台抓取。

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

从 V1.1 升级到 V1.2 时，migration 会新增本机画像资料和建议的目标关系字段；已有关注对象、收藏、日报和画像建议保留不变。升级后在扩展管理页点击“重新加载”，并按下文安装或刷新 Personal Radar 插件。若曾把 V1.1 Skill 手工复制到 `%USERPROFILE%\.codex\skills\personal-radar-research`，确认插件可用后删除该旧副本，避免出现两个同名 Skill。

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

## 安装 Personal Radar Codex 插件

仓库中的 `plugins/personal-radar` 是最小 Codex 插件，内部只包含研究 Skill、公开规则和本地服务检查脚本，不包含 MCP 服务、常驻进程或定时器。V1.2 删除了重复的顶层 Skill 副本，研究逻辑只有这一处入口。

在项目根目录为 Codex 注册 repo marketplace：

```powershell
codex plugin marketplace add .
codex plugin add personal-radar@personal
```

重新启动 Codex，并在新任务中明确调用：

```text
使用 $personal-radar-research 对我的一个关注方向执行今天的三维研究
```

一次调用只执行一轮研究任务：

0. 从本地 Personal Radar 读取关注方向、启用关键词、已确认精品链接和近期已保存内容，作为上下文与去重基线；没有精品链接也能继续。
1. 热点维：在哔哩哔哩、抖音及与主题适配的主流公开平台寻找近期讨论，记录可见热度信号和时效。
2. 官方维：打开官网、正式公告、权威机构或可确认的官方账号，核对事实与正式口径。
3. 补充维：从 3–7 个安全、不同域名的小众公开来源中随机选择一个，寻找主流遗漏的信息。
4. 生成中文报告，按三个维度给出摘要、时间、价值、事实/观点/不确定性和可验证原始链接。

Skill 可以在 Codex 后台任务中持续完成这一轮浏览和整理，但报告完成后立即停止研究。未调用时绝不运行，不创建后台监控、轮询器、通用队列、系统定时任务或常驻 Agent。

### 本地服务与浏览器边界

调用时，Skill 先检查 `127.0.0.1:3210`。服务未运行时，它可以调用仓库已有的 `start-personal-radar.cmd`；脚本仍只监听本机。需要系统权限时必须说明并请求，不能静默提权。报告结尾会说明服务原本是否运行、是否由本轮启动，以及是否仍保持运行。

公开页面优先由 Codex 托管浏览器读取。需要登录、验证码、二维码、同意页或站点交互时，会显示真实限制并让用户在自己的浏览器主动完成；插件和扩展都不读取 Cookie、密码、历史、私信、支付信息或会话令牌，也不绕过平台限制。

研究报告默认不写入 SQLite。用户明确确认某条内容后，才会逐条写入收藏；用户明确说“有价值”或“加入精品渠道”后，才会把精确账号、栏目、主题或网站写入私有精品链接配置。平台主站写入某个关注对象的 `sources` 还需要单独确认，发现结果不会自动提升。

个人配置模板位于 `plugins/personal-radar/skills/personal-radar-research/config/personal.example.json`，精品链接模板位于同目录的 `curated-sources.example.md`。用户确认常用安全选择后，可复制为 `personal.json` 和 `curated-sources.md`；这两个私有文件已被 Git 忽略，公开模板只使用虚构的 `example.com` 数据。

## 画像证据边界

“简单画像”保留帮助用户看清自己的方向，但不是自动诊断：

- 用户先亲自填写并保存自我评价和目标/追求；两项缺一时不生成建议。
- 内容证据只来自用户已经确认保存的日报条目，不使用尚未保存的研究热点。
- 每条待确认建议同时说明日报证据和与用户目标的关系；用户确认后才进入本机画像。
- 服务端继续过滤性格诊断、生活状态、健康、政治、宗教、性取向等敏感属性与未经确认的推断。

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
plugins/      Personal Radar Codex 插件与研究 Skill
tests/        虚构数据测试
docs/         公开架构说明
```

公开架构见 `docs/architecture.md`。开发过程中的冻结需求和内部任务板不属于运行所需文件，因此不随公开仓库发布。
