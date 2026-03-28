
# 🧠 Knowledge Extraction & Classification Assistant (v7.2 Cohesion & Topology Edition)

## 🎯 Objective

Please carefully read the provided [Source Text] (which may contain image links). Extract valuable knowledge points and strictly categorize them into "Concepts", "Skills", "Rules", "Issues", and "Insights".

To facilitate importing these knowledge points as "atomic notes" into my PKM (Personal Knowledge Management) system (e.g., Obsidian/Logseq), **you must output each extracted knowledge point as a separate, independent Markdown code block, and automatically build their directed topological relationships in the YAML.**

## 🔍 Deep Extraction & Topology Instructions (CRITICAL)

To prevent knowledge granularity loss, avoid over-fragmentation, and ensure graph connectivity, you must absolutely adhere to the following principles:

1.  **Reject Vagueness, Absolute Fidelity**: If the source text contains specific code snippets, configuration parameters, API names, exact data metrics, or shortcuts, they MUST be preserved 100% as-is in the cards. "Show, Don't Tell".
    
2.  **Contextual Cohesion vs. Atomic Splitting (Crucial Balance)**:
    
    -   **DO NOT over-fragment cohesive thoughts.** If multiple steps, configurations, or sub-skills form a single, continuous workflow (SOP) or a unified logical chain, **keep them together in ONE card** to preserve context.
        
    -   **ONLY split** them into separate independent cards if they address distinctly different scenarios, independent problems, or loosely related concepts.
        
3.  **Carpet-Bombing Scan**: Suppress the urge to "quickly summarize". Scan the text paragraph by paragraph from beginning to end to ensure no technical details in the middle are missed.
    
4.  **Topology Links**: Automatically analyze the logical dependencies among the extracted cards. Use the bidirectional link format `[[Card Full Name]]` to fill the `up` (parent/prerequisite), `down` (child/derived), and `related` (peer/supplementary) fields in the YAML. **Only link to cards extracted in this current batch.**
    

## ⚙️ Core Output Requirements

1.  **Atomic Output**: Each core concept must exclusively occupy one complete Markdown code block (starting with `markdown and ending with` ).
    
2.  **Single Card Bilingual**: Within EACH independent code block, output the complete English content first, then use a `---` separator, followed immediately by the professional Chinese translation.
    
3.  **Pure English YAML Tags**: All tag values in the YAML metadata (e.g., tool, domain) MUST strictly use pure English words. Never use Chinese for tags.
    
4.  **Retain Key Images**: If the text contains critical image links (e.g., `![alt](url)`), you must copy the original image links as-is into the card and add a brief caption.
    

## 📚 Classification Criteria

-   **💡 Concept (Principle/Architecture)**: Explains _what it is_ and _how it works_ (e.g., system architecture, mental models).
    
-   **🛠️ Skill (Action/SOP)**: A tool/action to solve specific problems (e.g., code templates, commands, workflows). Keep contiguous steps together.
    
-   **⚖️ Rule (Constraint/Standard)**: Baseline settings or constraints that must be followed (e.g., syntax limits, naming conventions).
    
-   **🐛 Issue (Troubleshooting/Bug)**: Specific problems, error logs, trigger conditions, and solutions.
    
-   **👁️ Insight (Architecture/Decision)**: Subjective analysis, architecture decisions (ADRs), trade-offs, or evaluations.
    

## 📝 Output Format

Please strictly follow the templates below. **You must retain specific technical details, preserve cohesive workflows, and accurately fill in the topology links.**

### 1. Overview Card Format

_(Must be output as the first code block)_

```markdown
---
type: [Overview]
domain: [] # Strictly English
---
# 📄 Overview: [Core Theme / One-sentence summary]

- **Abstract**: [Briefly summarize what core problem this text solves]

---
*Chinese Version / 中文版:*
## 📄 概述：[核心主题]
- **一句话摘要**：[简短概括这篇文章/笔记解决了什么核心问题]

```

### 2. Concept Card Format

```markdown
---
type: [Concept]
tool: [] # Strictly English
domain: [] # Strictly English
architecture: [] # Strictly English
up: [] # Parent card full name in wikilink format, e.g., ["[[💡 Higher-level concept]]"], leave empty if none
down: [] # Derived child cards, e.g., ["[[🛠️ Related Skill]]", "[[🐛 Related Issue]]"]
related: [] # Peer related cards
---
# 💡 [Concept Name: Be specific, e.g., "Transformer's QKV Matrix Multiplication"]

- **Definition / Core Idea**: [In-depth and specific definition, including core terms]
- **How it Works / Architecture**: [Detailed explanation of underlying mechanism. MUST include specific parameters, formulas, or image links `![alt](url)`]
- **Why it Matters**: [How does knowing this help in practice or code generation?]

---
*Chinese Version / 中文版:*
## 💡 [概念名称]
- **定义 / 核心理念**：[...]
- **运作机制 / 架构**：[... 必须包含具体的参数、公式或图表链接]
- **实际意义**：[...]

```

### 3. Skill Card Format

```markdown
---
type: [Skill]
tool: []
domain: []
architecture: []
up: [] # Usually the Concept card this skill relies on
down: [] # Derived sub-operations or Issues
related: []
---
# 🛠️ [Skill Name: Be specific, e.g., "Using Cursor to Generate React Route Config"]

- **Trigger Scenario**: [Under what specific business or error scenarios should this be used?]
- **Input Variables**: [Prerequisites, environment variables, or API keys needed]
- **Execution/Template**:
  > [CRITICAL: You must place the uncut specific code, complete continuous workflow steps, Prompt template, or detailed CLI commands here. Retain original image links `![alt](url)`]

---
*Chinese Version / 中文版:*
## 🛠️ [技能名称]
- **触发场景**：[...]
- **输入变量**：[...]
- **执行内容/模板**：
  > [... 强烈要求：放置未经删减的具体代码、连贯的操作步骤、完整的 Prompt 模板或 CLI 命令]

```

### 4. Rule Card Format

```markdown
---
type: [Rule]
tool: []
domain: []
architecture: []
up: []
down: []
related: []
---
# ⚖️ [Rule Name: e.g., "Do not call async state updates directly in useEffect"]

- **Constraint Details**: [Specific configuration values, syntax limits to follow]
- **Do & Don't**: [CRITICAL: Must provide exact code snippets for both correct (Do) and incorrect (Don't) approaches]

---
*Chinese Version / 中文版:*
## ⚖️ [规则名称]
- **约束详情**：[...]
- **正反例对照**：[... 强制：分别展示正确和错误的代码片段]

```

### 5. Issue Card Format

```markdown
---
type: [Issue]
tool: []
domain: []
architecture: []
up: [] # The underlying Concept or violated Rule causing this issue
down: []
related: []
---
# 🐛 [Exact Error Message: e.g., "TypeError: Cannot read properties of undefined (reading 'map')"]

- **Symptom / Error Log**: [CRITICAL: Paste the raw error log code block as-is. Retain screenshot links]
- **Root Cause**: [In-depth analysis of the specific cause at the code level]
- **Solution / Workaround**: [Specific fix code or specific troubleshooting steps]

---
*Chinese Version / 中文版:*
## 🐛 [报错核心信息]
- **症状 / 报错日志**：[... 强制：原样粘贴关键报错日志代码块]
- **根本原因**：[...]
- **解决方案 / Workaround**：[... 具体的修复代码或排查步骤]

```

### 6. Insight Card Format

```markdown
---
type: [Insight]
tool: []
domain: []
architecture: []
up: []
down: []
related: []
---
# 👁️ [Insight / Decision Name: e.g., "Why abandon Webpack for Vite"]

- **Context / Background**: [The pain points or metrics at the time, e.g., "Build time exceeded 3 minutes"]
- **Trade-offs / Analysis**: [Specific pros and cons. Must include comparison data or benchmarks]
- **Decision / Takeaway**: [The final tech stack or architecture chosen]

---
*Chinese Version / 中文版:*
## 👁️ [洞察 / 决策名称]
- **背景 / 语境**：[...]
- **权衡 / 分析**：[... 必须包含对比数据或基准测试结果]
- **决策 / 核心启示**：[...]

```

## 📥 Source Text

[Paste your English article, notes, or paragraphs here. If the text exceeds 5000 words, it is recommended to split it into multiple parts at the caller level to ensure maximum extraction accuracy]