import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function git(args) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
}

function requireIgnored(filePath) {
  const result = git(["check-ignore", "--no-index", "--quiet", "--", filePath]);
  if (result.status !== 0) failures.push(`.gitignore 未覆盖：${filePath}`);
}

for (const filePath of [
  ".data/database.sqlite",
  ".data/database.sqlite-wal",
  ".env.local",
  ".env.production.local",
  ".npmrc",
  "backups/personal-radar-backup.zip",
  "exports/personal-radar-backup.zip",
  "logs/server.log",
  "extension/.local/state.json",
  "extension/.storage/state.json",
  "private.sqlite",
  "private.sqlite-wal",
  "client-secret.pem"
]) {
  requireIgnored(filePath);
}

if (git(["check-ignore", "--no-index", "--quiet", "--", ".env.example"]).status === 0) {
  failures.push(".env.example 不应被 Git 忽略");
}

const listed = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
if (listed.status !== 0) {
  failures.push(`无法读取公开仓库候选文件：${listed.stderr.trim() || "git ls-files 失败"}`);
}

const candidateFiles = (listed.stdout ?? "")
  .split("\0")
  .filter(Boolean)
  .map((entry) => entry.replaceAll("\\", "/"));

const forbiddenPaths = [
  /(^|\/)\.data\//u,
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)\.npmrc$/u,
  /(^|\/)(?:backup|backups|exports|logs?)\//iu,
  /(^|\/)extension\/(?:\.local|\.storage)\//u,
  /\.(?:sqlite(?:-.+)?|db(?:-.+)?|zip|log|bak|backup|pem|key|p12|pfx)$/iu,
  /(^|\/)(?:credentials|secrets)[^/]*\.json$/iu
];

for (const filePath of candidateFiles) {
  if (filePath === ".env.example") continue;
  if (forbiddenPaths.some((pattern) => pattern.test(filePath))) {
    failures.push(`公开仓库候选中包含本地或敏感文件：${filePath}`);
  }
}

const textSecretPatterns = [
  { label: "私钥正文", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { label: "OpenAI 风格密钥", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u },
  { label: "Anthropic 风格密钥", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/u },
  { label: "GitHub 访问令牌", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/u },
  { label: "AWS 访问密钥", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { label: "本机用户绝对路径", pattern: /\b[A-Za-z]:\\Users\\[^\\\r\n]+/u }
];

const forbiddenPersonalMarkers = [
  { label: "个人化示例关注对象", value: ["北京", "交通大学"].join("") },
  { label: "个人化示例频道", value: ["北交", "吧"].join("") },
  { label: "个人化示例域名", value: ["bj", "tu"].join("") },
  { label: "本机用户名", value: ["luojia", "fish"].join("") },
  { label: "本机用户目录编号", value: ["30", "691"].join("") }
];

for (const filePath of candidateFiles) {
  const absolutePath = path.join(projectRoot, filePath);
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;

  const content = fs.readFileSync(absolutePath, "utf8");
  for (const { label, pattern } of textSecretPatterns) {
    if (pattern.test(content)) failures.push(`${filePath} 疑似包含${label}`);
  }
  for (const { label, value } of forbiddenPersonalMarkers) {
    if (content.toLowerCase().includes(value.toLowerCase())) failures.push(`${filePath} 包含${label}`);
  }
}

const examplePath = path.join(projectRoot, ".env.example");
const example = fs.readFileSync(examplePath, "utf8");
for (const name of ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"]) {
  if (!new RegExp(`^${name}=$`, "mu").test(example)) {
    failures.push(`.env.example 中 ${name} 必须保持空白`);
  }
}
if (/https?:\/\//iu.test(example)) failures.push(".env.example 不得包含真实服务地址");

const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "extension", "manifest.json"), "utf8"));
if (JSON.stringify(manifest.permissions) !== JSON.stringify(["activeTab", "scripting"])) {
  failures.push("扩展 permissions 必须严格保持为 activeTab、scripting");
}
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(["http://127.0.0.1:3210/*"])) {
  failures.push("扩展 host_permissions 必须严格保持为本机 Personal Radar 地址");
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
for (const scriptName of ["dev", "start"]) {
  const command = packageJson.scripts?.[scriptName] ?? "";
  if (!command.includes("--hostname 127.0.0.1") || !command.includes("--port 3210")) {
    failures.push(`npm ${scriptName} 必须显式监听 127.0.0.1:3210`);
  }
}

const setupScript = fs.readFileSync(path.join(projectRoot, "setup-windows.cmd"), "utf8");
for (const command of ["npm.cmd ci", "npm.cmd run db:migrate", "npm.cmd run build"]) {
  if (!setupScript.includes(command)) failures.push(`setup-windows.cmd 缺少必要命令：${command}`);
}
const startScript = fs.readFileSync(path.join(projectRoot, "start-personal-radar.cmd"), "utf8");
for (const command of ["npm.cmd run db:migrate", "npm.cmd start"]) {
  if (!startScript.includes(command)) failures.push(`start-personal-radar.cmd 缺少必要命令：${command}`);
}
for (const [filePath, content] of [
  ["setup-windows.cmd", setupScript],
  ["start-personal-radar.cmd", startScript]
]) {
  if (/0\.0\.0\.0|--hostname\s+(?!127\.0\.0\.1\b)/iu.test(content)) {
    failures.push(`${filePath} 包含非本机监听地址`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`[Personal Radar] 公开仓库安全检查失败：\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}

process.stdout.write(
  `[Personal Radar] 公开仓库安全检查通过（检查 ${candidateFiles.length} 个候选文件）：忽略规则、空白示例配置、扩展权限、Windows 脚本、监听地址和常见密钥特征均符合要求。\n`
);
