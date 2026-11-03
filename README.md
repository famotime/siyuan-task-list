# Task List (拾事) - Unified Task Aggregation for SiYuan Note

<p align="center">
  <b>散落任务随手拾，归拢手边事事办</b><br>
  <i>Gather scattered tasks with ease, bring everything together to get things done.</i>
</p>

<p align="center">
  <b>English</b> · <a href="./README_zh_CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/famotime/siyuan-task-list/main/preview.webp" alt="Task List Preview" width="850" />
</p>

---

## 💡 Why Task List (拾事)?

In SiYuan Note, we frequently jot down to-do items (`- [ ] task`) across various contexts: action items in meeting notes, milestone tasks in project plans, key goals in weekly reviews, or action steps in reading notes.

However, as notes accumulate, this distributed workflow introduces common frustrations:
- 🔍 **Fragmented & Forgotten**: Checkbox tasks get buried deep inside hundreds of nested documents. Without a centralized hub, critical items easily slip through the cracks.
- 🧭 **Decontextualized Todo Lists**: Many external task tools strip away document context, showing only isolated one-line descriptions. After a few days, it's hard to recall why or under what heading a task was created.
- 🔒 **Data Disruption Concerns**: Automated sorting or rewriting tools often tamper with list layouts or corrupt nested markdown structures in source documents.

**Task List (拾事) is crafted to solve these problems**: It renders a **real-time, non-destructive, and structured** task panorama in your right-side dock panel. Gain birds-eye visibility over your goals while retaining instant one-click navigation back to the exact block in your notes.

---

## 🎯 Core Use Cases

### 1. In-Depth Writing & Drafting: Stay Focused on the Present
- **Scenario**: Working on a long specification document, roadmap, or meeting minute with numerous interspersed action items.
- **Value**: Switch to **"Active Document"** mode to aggregate all tasks in the current note instantly. Check off completed items directly from the panel or click any task to immediately jump and **flash-highlight** the exact source block in the editor.

### 2. Multi-Document Project Tracking: Cross-Doc Scopes & 1-Click Favorites
- **Scenario**: Complex projects typically span a master document, several sub-documents, and referenced docs linked via block refs or embed blocks.
- **Value**:
  - Switch to **"Specified Path"** mode with optional **"Include Subdocuments"** and **"Include Linked Documents"** to capture all tasks across your project ecosystem.
  - **Quick Favorites**: Save frequent project paths along with their filter settings (subdoc/link toggles, status, and heading levels) into **Favorites** (up to 10 entries). Effortlessly alternate between key project boards with a single click.

### 3. Periodic Knowledge-Base Sweeps: Global Review with Smart Exclusion
- **Scenario**: Weekly, monthly, or quarterly reviews where you need a complete overview of all pending backlog items.
- **Value**:
  - Choose **"Notebook"** or **"All Notebooks"** to inspect pending tasks across your entire workspace.
  - **Exclude Paths**: Prevent old archives, template vaults, or daily draft folders from cluttering your review. Easily configure exclusion rules in settings, or hover over any document header in the task tree and click to **exclude the document with one tap**.

### 4. Hierarchical Task Execution: Clear Tree Indentation & Progress Tracking
- **Scenario**: Complex action items with nested sub-tasks or chapters requiring independent milestone tracking.
- **Value**:
  - Preserves hierarchical **sub-task indentation** and tree guide lines, with full visual support for SiYuan's native custom task markers (e.g., `[-]`, `[/]`).
  - Group headers automatically calculate and display completion progress **(open tasks / total tasks)** for each section.

---

## ✨ Key Advantages & Features

### 🛡️ Non-Destructive "Read-Only Projection" Architecture
- The dock panel functions strictly as a safe projection. Searching, filtering, folding, or displaying open tasks first will **never mutate the block order or typography of your source documents**.
- The sole writeback action is updating checkbox states via SiYuan's specialized kernel API (`updateTaskListItemMarker`), ensuring nested sub-lists and inline comments remain completely intact.

### 🌲 Full Context Preservation: Notebook → Document → Heading Tree → Task Clusters
- Say goodbye to flat, disconnected checklists. Tasks are organized systematically through your note's authentic hierarchy (`H1 ~ H6` headings).
- **Heading Level Filtering**: Selectively toggle specific heading levels (e.g., display only H1/H2) or flatten directly into document lists to adapt to your preferred information density.
- **1-Click Expand / Collapse All**: Hover over document headers to quickly fold or unfold all chapters and tasks at once.

### ⚡ Intelligent Sorting & Seamless Interaction
- **Open Tasks First**: Pending tasks in the same list block can be dynamically elevated to the top while keeping their stable relative document order.
- **Tri-State Filter & Real-Time Highlight**: Filter effortlessly across "All / Open / Done" and search keywords with instant on-the-fly text highlighting.
- **Two-Way Debounced Synchronization**: The panel automatically refreshes when documents are edited or saved in SiYuan, and checking off items in the panel writes back immediately.

---

## 📖 Quick Interaction Guide

| Area | Description |
| :--- | :--- |
| **Top Scope Bar** | Click the mode chip to toggle between 4 scopes (Active Doc / Specified Path / Notebook / All Notebooks). Click the star icon to bookmark the current path & filter presets. |
| **Filter & Search Bar** | Switch status between "All / Open / Done"; type to search with real-time keyword highlighting; open the right menu to customize visible heading levels (H1-H6). |
| **Doc & Group Headers** | Click to fold/unfold; inspect progress `(open / total)` on the right; use hover actions to **Expand/Collapse All** or **Exclude Document**. |
| **Task Rows** | Click the checkbox to toggle completion and write back safely; click task text or the jump icon to navigate and flash-highlight the source block. |

---

## ⚙️ Plugin Settings

In SiYuan Note **Settings** → **Bazaar** / **Plugins** → **Task List (拾事)**:
- **Sort open tasks first**: When enabled, incomplete tasks in the same list block are elevated above completed ones. When disabled, the original document order is preserved.
- **Aggregation limit**: Maximum number of tasks fetched per query (default: 2,000, up to 100,000) to override the kernel's default cutoff, accompanied by friendly in-app truncation notices.

---

## 🔌 Compatibility & Installation

- **Minimum Version**: SiYuan Note `v3.8.5` and above.
- **Installation**:
  1. Open SiYuan Note **Settings** → **Bazaar**;
  2. Search for `Task List`, `拾事`, or `siyuan-task-list`;
  3. Click **Install** and enable it. The Task List icon will appear in your right dock bar.

---

## 💬 Feedback & Community

- **Issues & Suggestions**: Feel free to submit questions and feature requests on [GitHub Issues](https://github.com/famotime/siyuan-task-list/issues).
- If Task List (拾事) makes your daily note-taking and task tracking more productive, please give it a ⭐️ **Star** on GitHub!
