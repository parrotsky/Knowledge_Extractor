
# 🧠 知识点自动提取与分类器 (v7.2 连贯性与拓扑增强版)

## 🎯 任务目标

请仔细阅读我提供的【待处理文本】（可能包含图文链接），提取其中有价值的知识点，并严格按照“Concept（概念）”、“Skill（技能）”、“Rule（规则）”、“Issue（问题）”和“Insight（洞察）”的维度进行分类。

为了方便我将知识点作为“原子化笔记”存入双链知识库（如 Obsidian/Logseq），**你必须将提取出的每一个知识点分别输出为一个独立的 Markdown 代码块，并在 YAML 中自动构建它们之间的有向拓扑关联。**

## 🔍 深度提取与拓扑构建指令 (CRITICAL)

为了防止知识颗粒度丢失、避免过度碎片化，并确保知识图谱的连通性，你必须绝对遵守以下原则：

1.  **拒绝空泛，绝对保真**：只要源文本中出现了具体的代码片段、配置参数、API 名称、确切的数据指标或快捷键，必须 100% 原样保留在卡片中。“Show, Don't Tell”。
    
2.  **上下文连贯性 vs. 原子化拆分 (关键平衡)**：
    
    -   **绝不能将连贯的思路过度碎片化**。如果多个步骤、配置或子技能构成了一个单一的、连贯的工作流（SOP）或统一的逻辑链，**必须将它们完整保留在同一张卡片中**以维持上下文。
        
    -   **仅当**它们解决截然不同的场景、独立的问题或松散关联的概念时，才将它们拆分为独立的卡片。
        
3.  **逐段地毯式扫描**：请压制你“快速总结全文”的冲动。从文章开头到结尾逐段扫描，确保中间段落的技术细节不被遗漏。
    
4.  **构建拓扑双链关系 (重点)**：请自动分析本次提取出的各卡片之间的逻辑依赖，并使用双向链接格式 `[[卡片全名]]` 填充 YAML 中的 `up`（父节点/前置知识）、`down`（子节点/衍生应用）、`related`（平级/相关补充）字段。**仅限关联本次提取出的卡片名称。**
    

## ⚙️ 核心输出要求

1.  **原子化输出**：每个核心概念必须独占一个完整的 Markdown 代码块（以 `markdown 开头，` 结尾）。
    
2.  **单卡片双语**：每个代码块内，先输出完整中文内容，再用 `---` 分隔输出英文翻译。
    
3.  **纯英文 YAML 标签**：顶部 YAML 的 `type`, `tool`, `domain`, `architecture` 必须全英文。绝不允许出现中文标签。
    
4.  **保留关键配图**：如有关键图片链接（如 `![alt](url)`），务必原样复制插入并附上图注。
    

## 📚 分类标准参考

-   **💡 Concept (概念/原理)**：解释“它是什么”及“如何运作”。(如：架构设计、底层机制)。
    
-   **🛠️ Skill (技能/动作)**：解决具体问题的操作指南。(如：SOP、代码模板、特定命令)。**保持连贯的步骤完整**。
    
-   **⚖️ Rule (规则/规范)**：必须遵守的底线或约束。(如：命名规范、内存限制、语法禁忌)。
    
-   **🐛 Issue (问题/踩坑)**：遇到的具体 Bug 报错、触发条件及解决方案。
    
-   **👁️ Insight (洞察/决策)**：架构选型决策（ADR）、优劣势权衡（Trade-off）。
    

## 📝 输出格式要求

请严格按照以下模板格式输出。**必须保留具体细节、维持连贯的工作流，并准确填充拓扑双链！**

### 1. 知识源概述卡片格式

_(必须作为第一个代码块输出)_

```markdown
---
type: [Overview]
domain: [] # 强制纯英文
---
# 📄 概述：[一句话总结的核心主题]

- **一句话摘要**：[简短概括这篇文章/笔记解决了什么核心问题]

---
*English Version:*
## 📄 Overview: [Core Theme]
- **Abstract**: [Brief abstract]

```

### 2. Concept (概念) 卡片格式

```markdown
---
type: [Concept]
tool: [] # 强制纯英文
domain: [] # 强制纯英文
architecture: [] # 强制纯英文
up: [] # 填入双链格式的父级卡片全名，如 ["[[💡 更高维度的概念名称]]"]，没有留空
down: [] # 填入衍生的子卡片全名，如 ["[[🛠️ 相关的技能名称]]", "[[🐛 相关的报错名称]]"]
related: [] # 平级相关的卡片双链
---
# 💡 [概念名称：需具体到细分机制，如“Transformer 的 QKV 矩阵乘法”]

- **定义 / 核心理念**：[深入且具体的定义，包含核心术语]
- **运作机制 / 架构**：[详细解释其底层机制或结构。必须包含具体的参数、公式或图表链接 `![alt](url)`]
- **实际意义**：[了解这个概念对实际开发或代码生成有什么实质性帮助？]

---
*English Version:*
## 💡 [Concept Name]
- **Definition / Core Idea**: [...]
- **How it Works / Architecture**: [... Must include specific parameters/formulas/image links]
- **Why it Matters**: [...]

```

### 3. Skill (技能) 卡片格式

```markdown
---
type: [Skill]
tool: [] 
domain: [] 
architecture: [] 
up: [] # 通常是这个技能依赖的 Concept 卡片
down: [] # 衍生出的细分操作或 Issue
related: [] 
---
# 🛠️ [技能名称：需具体，如“使用 Cursor 生成 React 路由配置”]

- **触发场景**：[在什么具体的业务或报错情况下使用？]
- **输入变量**：[执行此技能需要的前置条件、环境变量或 API 密钥]
- **执行内容/模板**：
  > [强烈要求：必须在此处放置未经删减的具体代码、连贯的操作步骤、完整的 Prompt 模板或 CLI 命令。保留原图链接 `![alt](url)`]

---
*English Version:*
## 🛠️ [Skill Name]
- **Trigger Scenario**: [...]
- **Input Variables**: [...]
- **Execution/Template**:
  > [... MUST include exact code, continuous workflow steps, raw prompt, or specific CLI commands]

```

### 4. Rule (规则) 卡片格式

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
# ⚖️ [规则名称：如“禁止在 useEffect 中直接调用异步状态更新”]

- **约束详情**：[具体需要遵守的配置项数值、语法限制等]
- **正反例对照**：[必须分别展示正确的代码片段 (Do) 和错误的代码片段 (Don't)]

---
*English Version:*
## ⚖️ [Rule Name]
- **Constraint Details**: [...]
- **Do & Don't**: [... MUST provide exact code snippets for both]

```

### 5. Issue (问题) 卡片格式

```markdown
---
type: [Issue]
tool: [] 
domain: [] 
architecture: [] 
up: [] # 导致此问题的底层 Concept 或违反的 Rule
down: [] 
related: [] 
---
# 🐛 [报错核心信息：如“TypeError: Cannot read properties of undefined (reading 'map')”]

- **症状 / 报错日志**：[原样粘贴关键的报错日志代码块，保留截图链接]
- **根本原因**：[深入代码底层的具体原因分析]
- **解决方案 / Workaround**：[具体的修复代码或具体的排查操作步骤]

---
*English Version:*
## 🐛 [Exact Error Message]
- **Symptom / Error Log**: [... MUST paste the raw error log]
- **Root Cause**: [...]
- **Solution / Workaround**: [... Specific fix code or steps]

```

### 6. Insight (洞察) 卡片格式

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
# 👁️ [洞察 / 决策名称：如“为什么放弃 Webpack 转向 Vite”]

- **背景 / 语境**：[当时面临的痛点指标，如“构建时间超过 3 分钟”]
- **权衡 / 分析**：[具体的优劣势对比，必须包含对比数据或基准测试结果]
- **决策 / 核心启示**：[最终确定的技术栈或架构方案]

---
*English Version:*
## 👁️ [Insight / Decision Name]
- **Context / Background**: [...]
- **Trade-offs / Analysis**: [... Must include comparison data or benchmarks]
- **Decision / Takeaway**: [...]

```

## 📥 待处理文本

[请在此处粘贴你需要提取的文章、笔记、段落。如果文本超过 5000 字，建议在调用端拆分成多个部分分批处理，以确保最高提取精度]