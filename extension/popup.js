const siteLabel = document.querySelector("#site");
const resultLabel = document.querySelector("#result");
const detectButton = document.querySelector("#detect");
const loggedInButton = document.querySelector("#logged-in");
const loggedOutButton = document.querySelector("#logged-out");
const targetSelect = document.querySelector("#target");
const captureButton = document.querySelector("#capture");
const captureResultLabel = document.querySelector("#capture-result");

let activeTab;
let activeOrigin;

function setResult(message, error = false) {
  resultLabel.textContent = message;
  resultLabel.classList.toggle("error", error);
}

function setCaptureResult(message, error = false) {
  captureResultLabel.textContent = message;
  captureResultLabel.classList.toggle("error", error);
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("本地应用返回了无法识别的结果");
  }
}

async function loadTargets() {
  const response = await fetch("http://127.0.0.1:3210/api/watch-targets");
  const payload = await readPayload(response);
  if (!response.ok || !Array.isArray(payload?.data)) throw new Error(payload?.error?.message || "无法读取关注对象");
  targetSelect.replaceChildren();
  for (const target of payload.data) {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = `${target.name}${target.enabled ? "" : "（已停用）"}`;
    targetSelect.append(option);
  }
  const firstEnabled = payload.data.find((target) => target.enabled);
  if (firstEnabled) targetSelect.value = firstEnabled.id;
  if (payload.data.length === 0) throw new Error("请先在 Personal Radar 创建关注对象");
  targetSelect.disabled = false;
  captureButton.disabled = false;
}

async function report(status, method, detectorVersion = "manual-v1") {
  if (!activeOrigin) return;
  for (const button of [detectButton, loggedInButton, loggedOutButton]) button.disabled = true;
  try {
    const response = await fetch("http://127.0.0.1:3210/api/site-login-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: activeOrigin, status, method, detectorVersion })
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload?.error?.message || "本地应用拒绝了验证结果");
    setResult(status === "authenticated" ? "已更新为绿灯：最近一次确认已登录。" : status === "unauthenticated" ? "已更新为灰灯：当前未登录。" : "无法可靠判断，状态保持灰灯。", false);
  } catch (error) {
    setResult(error instanceof Error ? error.message : "无法连接 Personal Radar", true);
  } finally {
    for (const button of [detectButton, loggedInButton, loggedOutButton]) button.disabled = false;
  }
}

function inspectVisibleLoginSignals() {
  const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
  const firstVisible = (selectors) => selectors.some((selector) => [...document.querySelectorAll(selector)].some(visible));
  const host = location.hostname.toLowerCase();

  if (host === "tieba.baidu.com") {
    const authenticated = firstVisible([".u_username", ".user_name", "a[href*='/home/main']", "a[href*='i.baidu.com']"]);
    const unauthenticated = firstVisible([".u_login", "a[href*='passport.baidu.com']"]);
    return { status: authenticated ? "authenticated" : unauthenticated ? "unauthenticated" : "unknown", detectorVersion: "tieba-v1" };
  }
  if (host === "www.bilibili.com" || host === "bilibili.com") {
    const authenticated = firstVisible([".header-entry-mini", ".v-img", "a[href*='space.bilibili.com']"]);
    const unauthenticated = firstVisible([".header-login-entry", ".login-entry"]);
    return { status: authenticated ? "authenticated" : unauthenticated ? "unauthenticated" : "unknown", detectorVersion: "bilibili-v1" };
  }
  return { status: "unknown", detectorVersion: "generic-v1" };
}

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  try {
    if (!tab || tab.incognito) throw new Error("INCOGNITO");
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    activeOrigin = url.origin;
    siteLabel.textContent = activeOrigin;
    await loadTargets();
  } catch {
    const incognito = Boolean(tab?.incognito);
    siteLabel.textContent = incognito ? "隐身窗口不允许采集" : activeOrigin || "当前标签页不是普通网站";
    const message = incognito ? "请在普通 Chrome/Edge 窗口打开具体内容页面。" : activeOrigin ? "无法连接 Personal Radar，请确认本地应用已启动。" : "请先打开普通 http 或 https 内容页面。";
    setCaptureResult(message, true);
    if (!activeOrigin || incognito) {
      setResult(message, true);
      for (const button of [detectButton, loggedInButton, loggedOutButton, captureButton]) button.disabled = true;
      targetSelect.disabled = true;
    }
  }
}

captureButton.addEventListener("click", async () => {
  if (!activeTab?.id || !targetSelect.value) return;
  captureButton.disabled = true;
  targetSelect.disabled = true;
  setCaptureResult("正在清理并保存当前页面…");
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: captureCurrentPage });
    if (!result?.ok) throw new Error(result?.error || "没有提取到可收录的正文");
    const response = await fetch("http://127.0.0.1:3210/api/saved-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchTargetId: targetSelect.value, ...result.data, aiSummary: "" })
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload?.error?.message || "本地应用拒绝了采集内容");
    const notes = [result.meta?.contentTruncated ? "正文已按 30,000 字截断" : "", result.meta?.selectionTruncated ? "选中文字已按 4,000 字截断" : ""].filter(Boolean);
    setCaptureResult(`已收录到 Personal Radar${notes.length ? `（${notes.join("；")}）` : ""}。`);
  } catch (error) {
    setCaptureResult(error instanceof Error ? error.message : "采集失败，请刷新具体内容页面后重试。", true);
  } finally {
    captureButton.disabled = false;
    targetSelect.disabled = false;
  }
});

detectButton.addEventListener("click", async () => {
  if (!activeTab?.id) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, func: inspectVisibleLoginSignals });
    await report(result.status, "extension_auto", result.detectorVersion);
  } catch {
    setResult("无法检查当前页面，请刷新网站后重试。", true);
  }
});
loggedInButton.addEventListener("click", () => void report("authenticated", "extension_user"));
loggedOutButton.addEventListener("click", () => void report("unauthenticated", "extension_user"));

void initialize();
