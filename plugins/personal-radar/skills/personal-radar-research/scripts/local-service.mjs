import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_URL = "http://127.0.0.1:3210/api/watch-targets";
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultProjectRoot = path.resolve(skillRoot, "..", "..");

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readPersonalConfig() {
  const configPath = path.join(skillRoot, "config", "personal.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid private config ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function probe() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(LOCAL_URL, { signal: controller.signal, cache: "no-store" });
    return response.ok
      ? { running: true, healthy: true, status: response.status }
      : { running: true, healthy: false, status: response.status, error: `Personal Radar returned HTTP ${response.status}` };
  } catch (error) {
    return { running: false, healthy: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveProjectRoot(config) {
  const candidates = [option("--project-root"), process.env.PERSONAL_RADAR_PROJECT_ROOT, config.projectRoot, defaultProjectRoot]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => path.resolve(value));
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "start-personal-radar.cmd")));
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  const command = process.argv[2] ?? "status";
  if (!new Set(["status", "start"]).has(command)) throw new Error("Usage: node scripts/local-service.mjs <status|start> [--project-root <path>]");

  const before = await probe();
  if (command === "status" || before.running) {
    process.stdout.write(`${JSON.stringify({ ...before, startedByRun: false, url: "http://127.0.0.1:3210" })}\n`);
    if (before.running && !before.healthy) process.exitCode = 1;
    return;
  }

  if (process.platform !== "win32") throw new Error("Automatic startup is supported only on Windows. Start Personal Radar manually with start-personal-radar.cmd.");
  const config = readPersonalConfig();
  const projectRoot = resolveProjectRoot(config);
  if (!projectRoot) throw new Error("Cannot locate start-personal-radar.cmd. Pass --project-root or confirm a projectRoot in config/personal.json.");

  const dataDirectory = path.join(projectRoot, ".data");
  fs.mkdirSync(dataDirectory, { recursive: true });
  const logPath = path.join(dataDirectory, "skill-service.log");
  const errorLogPath = path.join(dataDirectory, "skill-service-error.log");
  const scriptPath = path.join(projectRoot, "start-personal-radar.cmd");
  const processCommand = `cmd.exe /d /c call "${scriptPath}" 1>>"${logPath}" 2>>"${errorLogPath}"`;
  const launchCommand = [
    `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();`,
    `$startup = ([wmiclass]'Win32_ProcessStartup').CreateInstance();`,
    `$startup.ShowWindow = 0;`,
    `$result = ([wmiclass]'Win32_Process').Create(`,
    `${quotePowerShell(processCommand)}, ${quotePowerShell(projectRoot)}, $startup);`,
    `if ($result.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($result.ReturnValue)" };`,
    `$result.ProcessId`
  ].join(" ");
  const launch = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", launchCommand], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (launch.status !== 0) throw new Error(`Failed to launch Personal Radar: ${(launch.stderr || launch.stdout || `exit ${launch.status}`).trim()}`);
  const pid = Number.parseInt(launch.stdout.trim(), 10);

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const current = await probe();
    if (current.running) {
      process.stdout.write(`${JSON.stringify({ ...current, startedByRun: true, pid, projectRoot, logPath, errorLogPath, url: "http://127.0.0.1:3210" })}\n`);
      if (!current.healthy) process.exitCode = 1;
      return;
    }
  }

  const outputTail = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-3000) : "No standard output log was produced.";
  const errorTail = fs.existsSync(errorLogPath) ? fs.readFileSync(errorLogPath, "utf8").slice(-3000) : "No standard error log was produced.";
  const logTail = `${outputTail}\n${errorTail}`;
  throw new Error(`Personal Radar did not become reachable within 45 seconds. Startup log: ${logTail}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
