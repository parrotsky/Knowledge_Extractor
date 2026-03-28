const { Plugin, PluginSettingTab, Setting, Modal, MarkdownView, Notice, TFile, requestUrl } = require("obsidian");

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_CHUNK_LENGTH = 500;
const NOTICE_DURATION = 4000;

const API_PROVIDERS = {
  openai:   { label: "OpenAI",   endpoint: "https://api.openai.com/v1/chat/completions" },
  deepseek: { label: "Deepseek", endpoint: "https://api.deepseek.com/chat/completions"  },
};

const MODEL_OPTIONS = [
  "gpt-4o-mini",
  "deepseek-chat",
  "deepseek-reasoner",
];

function maskApiKey(key) {
  if (!key) return "";
  const prefixMatch = key.match(/^([a-zA-Z]+-)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const rest = key.slice(prefix.length);
  if (rest.length <= 6) return key;
  return `${prefix}${rest.slice(0, 3)}${"•".repeat(rest.length - 6)}${rest.slice(-3)}`;
}

const FRONTMATTER_STATUS_KEY       = "knowledge_extractor_status";
const FRONTMATTER_EXTRACTED_AT_KEY = "knowledge_extractor_extracted_at";
const FRONTMATTER_CARD_COUNT_KEY   = "knowledge_extractor_card_count";

const DEFAULT_SETTINGS = {
  apiKey:             "",
  apiProvider:        "openai",
  apiEndpoint:        "https://api.openai.com/v1/chat/completions",
  modelName:          "gpt-4o-mini",
  chunkMaxLength:     3000,
  outputFolderPath:   "AI Extracts",
  promptFilePathZh:   "Knowledge_Extractor_zh.md",
  promptFilePathEn:   "",
};

// ── Main Plugin ───────────────────────────────────────────────────────────────

class KnowledgeExtractorPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.markdownViewActions = new WeakSet();
    this.activeJob = null;
    this.activeSourceName = "待命";
    this.activeCardCount = 0;
  }

  async onload() {
    await this.loadSettings();

    this.statusBarItemEl = this.addStatusBarItem();
    this.buildStatusPanel();
    this.setIdleStatus();

    this.addRibbonIcon("brain-circuit", "知识提取助手（手动粘贴提取）", () => {
      new ManualPasteModal(this.app, this).open();
    });

    this.addCommand({
      id: "open-knowledge-extractor",
      name: "打开知识提取助手（手动粘贴提取）",
      editorCallback: (editor) => {
        new ManualPasteModal(this.app, this, editor).open();
      },
    });

    this.addCommand({
      id: "extract-current-markdown",
      name: "提取当前笔记或选中内容",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (!checking) this.openExtractionFromMarkdownView(view);
        return true;
      },
    });

    this.addCommand({
      id: "stop-current-extraction",
      name: "停止当前提取",
      checkCallback: (checking) => {
        if (!this.activeJob) return false;
        if (!checking) this.cancelActiveExtraction();
        return true;
      },
    });

    this.app.workspace.onLayoutReady(() => this.attachMarkdownViewActions());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.attachMarkdownViewActions())
    );

    this.addSettingTab(new KnowledgeExtractorSettingTab(this.app, this));
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // Migrate legacy promptFilePath key
    if (!this.settings.promptFilePathZh && saved?.promptFilePath) {
      this.settings.promptFilePathZh = saved.promptFilePath;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ── Extraction lifecycle ──────────────────────────────────────────────────

  async runExtraction(options) {
    if (this.activeJob) {
      new Notice("⚠️ 当前已有提取任务在运行，请先等待完成或点击「停止」。", NOTICE_DURATION);
      return;
    }

    const job = new ExtractionJob(this, options);
    this.activeSourceName = this.getSourceDisplayName(options);
    this.activeCardCount = 0;
    this.setStatusMessage("准备提取...");
    this.activeJob = job;
    this.stopStatusBarItemEl.style.display = "";

    try {
      await job.run();
    } finally {
      this.activeJob = null;
      this.stopStatusBarItemEl.style.display = "none";
    }
  }

  cancelActiveExtraction() {
    if (!this.activeJob) {
      new Notice("当前没有正在运行的提取任务。", NOTICE_DURATION);
      return;
    }
    this.activeJob.cancel();
    this.setStatusMessage("正在停止...");
    new Notice("⏹️ 已请求停止，当前分块完成后会中断。", NOTICE_DURATION);
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  buildStatusPanel() {
    this.statusBarItemEl.empty();
    this.statusBarItemEl.style.display = "flex";
    this.statusBarItemEl.style.alignItems = "center";
    this.statusBarItemEl.style.gap = "10px";

    this.statusSourceEl = document.createElement("span");
    this.statusDetailEl = document.createElement("span");
    this.statusCardsEl  = document.createElement("span");

    this.stopStatusBarItemEl = document.createElement("button");
    this.stopStatusBarItemEl.textContent = "停止";
    this.stopStatusBarItemEl.style.display = "none";
    this.stopStatusBarItemEl.style.cursor = "pointer";
    this.stopStatusBarItemEl.style.padding = "2px 8px";
    this.stopStatusBarItemEl.addEventListener("click", () => this.cancelActiveExtraction());

    this.statusBarItemEl.append(
      this.statusSourceEl,
      this.statusDetailEl,
      this.statusCardsEl,
      this.stopStatusBarItemEl
    );
  }

  setIdleStatus() {
    this.activeSourceName = "待命";
    this.activeCardCount = 0;
    this.statusSourceEl.textContent = "来源: 待命";
    this.statusDetailEl.textContent = "状态: 等待提取任务";
    this.statusCardsEl.textContent  = "卡片: 0";
  }

  setProgressStatus(current, total, cardCount) {
    const safeTotal   = Math.max(total, 1);
    const safeCurrent = Math.max(0, Math.min(current, safeTotal));
    this.activeCardCount = cardCount;
    this.statusSourceEl.textContent = `来源: ${this.activeSourceName}`;
    this.statusDetailEl.textContent = `分块: ${safeCurrent}/${safeTotal}`;
    this.statusCardsEl.textContent  = `卡片: ${cardCount}`;
  }

  setStatusMessage(message) {
    this.statusSourceEl.textContent = `来源: ${this.activeSourceName}`;
    this.statusDetailEl.textContent = `状态: ${message}`;
    this.statusCardsEl.textContent  = `卡片: ${this.activeCardCount}`;
  }

  // ── Markdown view integration ─────────────────────────────────────────────

  attachMarkdownViewActions() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      if (this.markdownViewActions.has(view)) continue;

      view.addAction("brain-circuit", "提取当前笔记或选中内容", () => {
        this.openExtractionFromMarkdownView(view);
      });
      this.markdownViewActions.add(view);
    }
  }

  async openExtractionFromMarkdownView(view) {
    const file = view.file;
    if (!(file instanceof TFile)) {
      new Notice("⚠️ 当前视图没有关联的 Markdown 文件。", NOTICE_DURATION);
      return;
    }

    const inputText = await this.getInputTextFromView(view);
    if (!inputText) {
      new Notice("⚠️ 当前笔记没有可供提取的内容。", NOTICE_DURATION);
      return;
    }

    const alreadyExtracted = await this.isSourceFileExtracted(file);
    if (alreadyExtracted) {
      const confirmed = await new ConfirmModal(
        this.app,
        "该笔记已经提取过",
        "当前笔记已经有提取标记了。要继续重新提取并生成新卡片吗？",
        "重新提取"
      ).openAndWait();

      if (!confirmed) {
        new Notice("已取消重新提取。", NOTICE_DURATION);
        return;
      }
    }

    new Notice("🧭 提取进度会显示在 Obsidian 底部状态栏。", NOTICE_DURATION);
    await this.runExtraction({
      inputText,
      editor: view.editor,
      sourceFile: file,
      sourceLabel: "markdown",
    });
  }

  async getInputTextFromView(view) {
    const selection = view.editor?.getSelection()?.trim();
    if (selection) return selection;

    const file = view.file;
    if (!(file instanceof TFile)) return "";
    return (await this.app.vault.read(file)).trim();
  }

  // ── Frontmatter helpers ───────────────────────────────────────────────────

  async isSourceFileExtracted(file) {
    const content = await this.app.vault.cachedRead(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!frontmatterMatch) return false;

    const body = frontmatterMatch[1] ?? "";
    const statusMatch = body.match(new RegExp(`^${FRONTMATTER_STATUS_KEY}:\\s*(.+)$`, "m"));
    const statusValue = statusMatch?.[1]?.trim().replace(/^['"]|['"]$/g, "");
    return statusValue === "extracted";
  }

  async markSourceFileExtracted(file, cardCount) {
    const updates = {
      [FRONTMATTER_STATUS_KEY]:       "extracted",
      [FRONTMATTER_EXTRACTED_AT_KEY]: new Date().toISOString(),
      [FRONTMATTER_CARD_COUNT_KEY]:   cardCount,
    };
    await this.app.vault.process(file, (content) => this.upsertFrontmatter(content, updates));
  }

  upsertFrontmatter(content, updates) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);

    if (!frontmatterMatch) {
      const newFields = Object.entries(updates)
        .map(([k, v]) => `${k}: ${this.formatFrontmatterValue(v)}`)
        .join("\n");
      return `---\n${newFields}\n---\n\n${content}`;
    }

    const existingBody = frontmatterMatch[1] ?? "";
    const afterFrontmatter = content.slice(frontmatterMatch[0].length);
    const updatedKeys = new Set();

    const updatedLines = existingBody.split("\n").map((line) => {
      const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
      if (!keyMatch) return line;
      const key = keyMatch[1];
      if (!key || !(key in updates)) return line;
      const value = updates[key];
      if (value === undefined) return line;
      updatedKeys.add(key);
      return `${key}: ${this.formatFrontmatterValue(value)}`;
    });

    for (const [key, value] of Object.entries(updates)) {
      if (!updatedKeys.has(key)) {
        updatedLines.push(`${key}: ${this.formatFrontmatterValue(value)}`);
      }
    }

    return `---\n${updatedLines.join("\n")}\n---${afterFrontmatter}`;
  }

  formatFrontmatterValue(value) {
    if (typeof value === "number") return String(value);
    return JSON.stringify(value);
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  getSourceDisplayName(options) {
    if (options.sourceFile instanceof TFile) return options.sourceFile.basename;
    if (options.sourceLabel === "manual") return "手动粘贴文本";
    return "当前笔记";
  }
}

// ── Manual Paste Modal ────────────────────────────────────────────────────────

class ManualPasteModal extends Modal {
  constructor(app, plugin, editor = null, initialText = "") {
    super(app);
    this.inputText = initialText;
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "🧠 知识提取助手（手动粘贴）" });

    const hint = contentEl.createEl("p", {
      text: "这里是手动文本提取入口。当前笔记提取请使用 Markdown 视图右上角按钮。",
    });
    hint.style.marginTop = "0";

    const textarea = contentEl.createEl("textarea", {
      attr: { placeholder: "请在此粘贴需要处理的技术文章、笔记或段落...", rows: "10" },
    });
    textarea.value = this.inputText;
    textarea.style.width = "100%";
    textarea.style.marginBottom = "10px";
    textarea.addEventListener("input", (e) => {
      this.inputText = e.target.value;
    });

    contentEl.createEl("button", { text: "🚀 一键提取并拆分入库" }).addEventListener("click", () => {
      if (!this.inputText.trim()) {
        new Notice("请输入内容！");
        return;
      }
      new Notice("🧭 提取进度会显示在 Obsidian 底部状态栏。", NOTICE_DURATION);
      this.plugin.runExtraction({
        inputText: this.inputText,
        editor: this.editor,
        sourceLabel: "manual",
      });
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ── Extraction Job ────────────────────────────────────────────────────────────

class ExtractionJob {
  constructor(plugin, options) {
    this.cancellationRequested = false;
    this.plugin = plugin;
    this.app = plugin.app;
    this.options = options;
  }

  cancel() {
    this.cancellationRequested = true;
  }

  async run() {
    if (!this.plugin.settings.apiKey) {
      new Notice("❌ 请先在插件设置中配置 API Key");
      this.plugin.setStatusMessage("缺少 API Key");
      return;
    }

    const prompt = await this.loadPromptFile(this.options.inputText);
    if (!prompt) {
      this.plugin.setStatusMessage("未找到可用 Prompt");
      return;
    }

    const chunks = this.splitTextIntoChunks(this.options.inputText);
    if (chunks.length === 0) {
      new Notice("⚠️ 没有可供提取的内容。");
      this.plugin.setStatusMessage("没有可提取内容");
      return;
    }

    const savedFiles = [];
    this.plugin.setProgressStatus(0, chunks.length, 0);

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (this.shouldStop()) return;

        const chunk = chunks[i];
        if (!chunk) continue;

        this.plugin.setProgressStatus(i + 1, chunks.length, savedFiles.length);

        const rawResponse = await this.callLLM(chunk, prompt);
        if (this.shouldStop()) return;

        if (!rawResponse) {
          new Notice(`⚠️ 第 ${i + 1} 部分返回空内容，已跳过。`, NOTICE_DURATION);
          continue;
        }

        const cards = this.parseMarkdownBlocks(rawResponse);
        if (cards.length === 0) {
          new Notice(`⚠️ 第 ${i + 1} 部分未解析到有效卡片。`, NOTICE_DURATION);
          continue;
        }

        const created = await this.saveCardsToVault(cards);
        if (this.shouldStop()) return;

        savedFiles.push(...created);
        this.plugin.setProgressStatus(i + 1, chunks.length, savedFiles.length);
      }

      if (savedFiles.length === 0) {
        new Notice("⚠️ 全部请求完成，但没有生成可保存的卡片。");
        this.plugin.setStatusMessage("已完成，但未生成卡片");
        return;
      }

      if (this.options.editor) {
        const links = savedFiles
          .map((f) => `![[${f.replace(/\.md$/, "")}]]`)
          .join("\n\n");
        this.options.editor.replaceSelection(`\n### 🔗 提取出的知识卡片\n\n${links}\n`);
      }

      if (this.options.sourceFile) {
        await this.plugin.markSourceFileExtracted(this.options.sourceFile, savedFiles.length);
      }

      this.plugin.setStatusMessage(`提取完成，共生成 ${savedFiles.length} 张卡片`);
      new Notice(`🎉 全部提取完成！共生成 ${savedFiles.length} 张卡片。`, NOTICE_DURATION);

    } catch (err) {
      console.error("提取失败:", err);
      this.plugin.setStatusMessage("提取失败，请查看控制台");
      new Notice("❌ 提取失败，请检查网络、API 配置或控制台日志");
    }
  }

  shouldStop() {
    if (!this.cancellationRequested) return false;
    this.plugin.setStatusMessage("提取已停止");
    new Notice("⏹️ 提取已停止。", NOTICE_DURATION);
    return true;
  }

  // ── Prompt loading ────────────────────────────────────────────────────────

  async loadPromptFile(inputText) {
    const zhPath = this.plugin.settings.promptFilePathZh.trim();
    const enPath = this.plugin.settings.promptFilePathEn.trim();

    if (!zhPath) {
      new Notice("❌ 请先在设置中配置中文 Prompt 文件路径。", NOTICE_DURATION);
      return null;
    }

    const isChinese = this.isChineseText(inputText);
    const preferredPath = isChinese ? zhPath : (enPath || zhPath);
    const prompt = await this.readPromptFromPath(preferredPath);

    if (prompt) {
      const usedFallback = !isChinese && !enPath;
      const label = usedFallback
        ? "中文 Prompt（英文回退）"
        : `${isChinese ? "中文" : "英文"} Prompt`;
      new Notice(`🔍 检测到${isChinese ? "中文" : "英文"}输入，已加载${label}。`, NOTICE_DURATION);
      return prompt;
    }

    // If English path failed, try falling back to Chinese
    if (!isChinese && preferredPath !== zhPath) {
      const fallback = await this.readPromptFromPath(zhPath);
      if (fallback) {
        new Notice("🔁 英文 Prompt 未找到，已自动回退到中文 Prompt。", NOTICE_DURATION);
        return fallback;
      }
    }

    new Notice(`❌ 找不到 Prompt 文件：${preferredPath}。`, NOTICE_DURATION);
    return null;
  }

  async readPromptFromPath(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    return this.app.vault.read(file);
  }

  isChineseText(text) {
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);
    return (chineseChars?.length ?? 0) > 30;
  }

  // ── Text chunking ─────────────────────────────────────────────────────────

  getChunkMaxLength() {
    const setting = Math.floor(this.plugin.settings.chunkMaxLength);
    return Number.isFinite(setting) && setting >= MIN_CHUNK_LENGTH
      ? setting
      : DEFAULT_SETTINGS.chunkMaxLength;
  }

  splitTextIntoChunks(text, maxLength = this.getChunkMaxLength()) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxLength) return [trimmed];

    // Try splitting on markdown headings first, then fall back to paragraphs
    const headingSegments = trimmed
      .split(/(?=^#{1,6}\s.+$)/gm)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const segments = headingSegments.length > 1
      ? headingSegments
      : trimmed.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 0);

    return this.packSegments(segments, maxLength);
  }

  packSegments(segments, maxLength) {
    const chunks = [];
    let current = "";

    for (const segment of segments) {
      if (segment.length > maxLength) {
        if (current) { chunks.push(current); current = ""; }
        chunks.push(...this.splitOversizedSegment(segment, maxLength));
        continue;
      }
      const candidate = current ? `${current}\n\n${segment}` : segment;
      if (candidate.length > maxLength) {
        if (current) chunks.push(current);
        current = segment;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : segments;
  }

  splitOversizedSegment(segment, maxLength) {
    const paragraphs = segment
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (paragraphs.length > 1) return this.packSegments(paragraphs, maxLength);
    return this.splitBySentence(segment, maxLength);
  }

  splitBySentence(text, maxLength) {
    const sentences = text.match(/[^。！？.!?\n]+[。！？.!?]?/g)
      ?.map((s) => s.trim())
      .filter((s) => s.length > 0) ?? [text.trim()];

    const chunks = [];
    let current = "";

    for (const sentence of sentences) {
      if (sentence.length > maxLength) {
        if (current) { chunks.push(current); current = ""; }
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength));
        }
        continue;
      }
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length > maxLength) {
        if (current) chunks.push(current);
        current = sentence;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  // ── LLM call ─────────────────────────────────────────────────────────────

  async callLLM(userContent, systemPrompt) {
    const response = await requestUrl({
      url: this.plugin.settings.apiEndpoint,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.plugin.settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.plugin.settings.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userContent },
        ],
      }),
    });
    return this.extractResponseText(response.json);
  }

  extractResponseText(json) {
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => part?.text)
        .filter((t) => typeof t === "string" && t.length > 0)
        .join("\n")
        .trim() || null;
    }
    return null;
  }

  // ── Card parsing & saving ─────────────────────────────────────────────────

  parseMarkdownBlocks(text) {
    const cards = [];
    const blockPattern = /```markdown\n([\s\S]*?)\n```/g;
    let match;

    while ((match = blockPattern.exec(text)) !== null) {
      const content = match[1]?.trim();
      if (!content) continue;

      const type  = content.match(/type:\s*\[(.*?)\]/)?.[1]?.trim() ?? "Unknown";
      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const safeName = title
        ? title.replace(/[\\/:*?"<>|]/g, "").trim()
        : `未命名卡片_${Date.now()}`;

      cards.push({ content, fileName: `${type} - ${safeName}.md` });
    }

    return cards;
  }

  async saveCardsToVault(cards) {
    const savedFiles = [];
    const folderPath = this.normalizeFolderPath(this.plugin.settings.outputFolderPath);

    if (folderPath) await this.ensureFolderExists(folderPath);

    for (const card of cards) {
      const rawPath   = folderPath ? `${folderPath}/${card.fileName}` : card.fileName;
      const finalPath = this.getUniqueFileName(rawPath);
      try {
        await this.app.vault.create(finalPath, card.content);
        savedFiles.push(finalPath);
      } catch (err) {
        console.error("文件创建失败:", err);
        new Notice(`⚠️ 创建文件失败: ${finalPath}`, NOTICE_DURATION);
      }
    }

    return savedFiles;
  }

  normalizeFolderPath(path) {
    return path.trim().replace(/^\/+|\/+$/g, "");
  }

  async ensureFolderExists(folderPath) {
    const parts = folderPath.split("/").filter((p) => p.length > 0);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  getUniqueFileName(filePath) {
    const dotIndex  = filePath.lastIndexOf(".");
    const base      = dotIndex === -1 ? filePath : filePath.slice(0, dotIndex);
    const extension = dotIndex === -1 ? ""        : filePath.slice(dotIndex);

    let candidate = filePath;
    let counter   = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = `${base} ${counter}${extension}`;
      counter++;
    }
    return candidate;
  }
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

class ConfirmModal extends Modal {
  constructor(app, title, message, confirmText) {
    super(app);
    this.title       = title;
    this.message     = message;
    this.confirmText = confirmText;
    this.resolver    = null;
  }

  openAndWait() {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p",  { text: this.message });

    const buttonRow = contentEl.createDiv();
    buttonRow.style.display        = "flex";
    buttonRow.style.gap            = "8px";
    buttonRow.style.justifyContent = "flex-end";

    buttonRow.createEl("button", { text: "取消" })
      .addEventListener("click", () => this.finish(false));

    buttonRow.createEl("button", { text: this.confirmText, cls: "mod-cta" })
      .addEventListener("click", () => this.finish(true));
  }

  onClose() {
    this.contentEl.empty();
    this.finish(false, false);
  }

  finish(result, closeModal = true) {
    const resolve = this.resolver;
    this.resolver = undefined;
    if (closeModal) this.close();
    resolve?.(result);
  }
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

class KnowledgeExtractorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "🧠 知识提取助手设置" });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("输入你的大模型 API Key")
      .addText((text) => {
        text.setPlaceholder("sk-...").setValue(maskApiKey(this.plugin.settings.apiKey));

        text.inputEl.addEventListener("focus", () => {
          text.setValue(this.plugin.settings.apiKey);
        });

        text.inputEl.addEventListener("blur", async () => {
          const val = text.getValue();
          if (val === this.plugin.settings.apiKey) {
            text.setValue(maskApiKey(val));
          } else {
            this.plugin.settings.apiKey = val;
            await this.plugin.saveSettings();
            text.setValue(maskApiKey(val));
          }
        });
      });

    new Setting(containerEl)
      .setName("API Endpoint")
      .setDesc("选择 API 服务商")
      .addDropdown((dropdown) => {
        for (const [key, { label }] of Object.entries(API_PROVIDERS)) {
          dropdown.addOption(key, label);
        }
        dropdown.setValue(this.plugin.settings.apiProvider);
        dropdown.onChange(async (value) => {
          this.plugin.settings.apiProvider = value;
          this.plugin.settings.apiEndpoint = API_PROVIDERS[value].endpoint;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("模型名称")
      .setDesc("选择要使用的模型")
      .addDropdown((dropdown) => {
        for (const model of MODEL_OPTIONS) {
          dropdown.addOption(model, model);
        }
        dropdown.setValue(this.plugin.settings.modelName);
        dropdown.onChange(async (value) => {
          this.plugin.settings.modelName = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("切片最大长度")
      .setDesc(`控制单个切片的最大字符数，建议不低于 ${MIN_CHUNK_LENGTH}。`)
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.chunkMaxLength))
          .setValue(String(this.plugin.settings.chunkMaxLength))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.chunkMaxLength =
              Number.isFinite(parsed) && parsed >= MIN_CHUNK_LENGTH
                ? parsed
                : DEFAULT_SETTINGS.chunkMaxLength;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("卡片输出目录")
      .setDesc("提取出的知识卡片会保存到这个 Vault 目录。留空则保存到根目录。")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.outputFolderPath)
          .setValue(this.plugin.settings.outputFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.outputFolderPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("中文 Prompt 文件路径")
      .setDesc("中文内容默认读取这个 Prompt 文件；英文未配置时也会回退使用它。")
      .addText((text) =>
        text
          .setPlaceholder("Knowledge_Extractor_zh.md")
          .setValue(this.plugin.settings.promptFilePathZh)
          .onChange(async (value) => {
            this.plugin.settings.promptFilePathZh = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("英文 Prompt 文件路径")
      .setDesc("可选。留空时，英文内容会自动回退到中文 Prompt。")
      .addText((text) =>
        text
          .setPlaceholder("Knowledge_Extractor_en.md")
          .setValue(this.plugin.settings.promptFilePathEn)
          .onChange(async (value) => {
            this.plugin.settings.promptFilePathEn = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = KnowledgeExtractorPlugin;
