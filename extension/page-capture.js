function captureCurrentPage() {
  const MAX_CONTENT_CHARS = 30000;
  const MAX_SELECTED_TEXT_CHARS = 4000;
  const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "FORM", "INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "NAV", "FOOTER", "HEADER", "ASIDE", "DIALOG", "IFRAME", "OBJECT", "EMBED"]);
  const sensitivePattern = /(?:password|passcode|login|log-in|sign[-_ ]?in|passport|private[-_ ]?message|direct[-_ ]?message|message[-_ ]?panel|chat[-_ ]?(?:panel|box|window)|inbox|checkout|payment|paywall|billing|credit[-_ ]?card|私信|站内信|聊天(?:框|窗口)?|支付|付款|结账|收银|银行卡|密码|登录)/iu;

  const normalizeText = (value) => String(value || "")
    .replace(/\u00a0/gu, " ")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/\s*\n\s*/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  const elementMetadata = (element) => ["id", "class", "aria-label", "data-testid", "role", "href", "autocomplete"]
    .map((name) => element?.getAttribute?.(name) || "")
    .join(" ");

  const isVisible = (element) => {
    if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" && style.opacity !== "0";
  };

  const cleanedText = (source) => {
    const clone = source.cloneNode(true);
    const sourceElements = [...source.querySelectorAll("*")];
    const clonedElements = [...clone.querySelectorAll("*")];
    clonedElements.forEach((element, index) => {
      const original = sourceElements[index];
      const editable = original?.isContentEditable || original?.getAttribute?.("contenteditable") === "true";
      if (!original || ignoredTags.has(original.tagName) || editable || !isVisible(original) || sensitivePattern.test(elementMetadata(original))) element.remove();
    });
    return normalizeText(clone.innerText || clone.textContent || "");
  };

  try {
    const pageUrl = new URL(location.href);
    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") return { ok: false, error: "当前标签页不是普通网页，无法采集。" };

    const candidateElements = [...document.querySelectorAll("article, main, [role='main']")];
    if (document.body) candidateElements.push(document.body);
    const candidates = [...new Set(candidateElements)].map(cleanedText).filter(Boolean);
    const content = candidates.reduce((longest, value) => value.length > longest.length ? value : longest, "");
    if (content.length < 50) return { ok: false, error: "当前页面没有足够的可见正文；请打开具体内容页面，等待加载完成后重试。" };

    const titleElement = document.querySelector("meta[property='og:title']");
    const title = normalizeText(titleElement?.getAttribute?.("content") || document.title || document.querySelector("h1")?.textContent || pageUrl.hostname).slice(0, 300);
    const selection = getSelection();
    const selectionParents = [selection?.anchorNode?.parentElement, selection?.focusNode?.parentElement].filter(Boolean);
    const unsafeSelection = selectionParents.some((element) => {
      if (element.closest?.("form,input,textarea,select,[contenteditable='true']")) return true;
      let current = element;
      while (current && current !== document.body) {
        if (sensitivePattern.test(elementMetadata(current))) return true;
        current = current.parentElement;
      }
      return false;
    });
    const rawSelectedText = unsafeSelection ? "" : normalizeText(selection?.toString?.() || "");

    return {
      ok: true,
      data: {
        title: title || pageUrl.hostname,
        url: pageUrl.href,
        contentExcerpt: content.slice(0, MAX_CONTENT_CHARS),
        selectedText: rawSelectedText.slice(0, MAX_SELECTED_TEXT_CHARS)
      },
      meta: {
        contentTruncated: content.length > MAX_CONTENT_CHARS,
        selectionTruncated: rawSelectedText.length > MAX_SELECTED_TEXT_CHARS
      }
    };
  } catch {
    return { ok: false, error: "页面结构无法安全读取，请刷新具体内容页面后重试。" };
  }
}
