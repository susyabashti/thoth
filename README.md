# thoth

A lightning-fast, highly extensible structural validator for markdown workspaces, written in TypeScript and optimized for the **Bun** runtime. 

Named after the Egyptian deity of wisdom, scribes, and precise calculation, `thoth` indexes your documentation ecosystem into an in-memory structural catalog to validate file paths, heading anchors, frontmatter integrity, and global directory coverage metrics at native runtime speeds.

---

## The Why

LLMs and AI agents are brilliant at reasoning, drafting, and architecting—but they are historically unreliable and expensive at performing strict "clerical" tasks. When asked to verify file integrity or cross-reference documentation layouts, agents:

* **Waste Tokens:** They perform dozens of expensive tool calls to read file trees.
* **Saturate Context:** They flood their context window with raw directory listings.
* **Hallucinate:** They "guess" paths, causing documentation to break silently as folders shift.

**`thoth`** moves verification out of the agent's "brain" and into your local workspace runtime or CI/CD pipeline. It gives your agents a deterministic, machine-readable source of truth. When `thoth` flags a workspace, the agent receives a precise line-number reference and an explicit error type—enabling it to fix problems autonomously.

---

## Key Features

* **⚡ Plugin-Driven Architecture:** Hooks cleanly into an expressive multi-stage lifecycle (`index`, `validate`, `afterValidate`) to run fast concurrent file parsing alongside comprehensive global validations.
* **📂 Global Workspace Coverage:** Moves beyond single-file scopes to enforce structural coordination, matching local markdown files against subdirectory config structures like `meta.json` or `sidebar.json`.
* **🎯 Granular Error Classification:** Distinguishes cleanly between dead file paths (`FILE_NOT_FOUND`), broken fragment hashes (`HEADING_NOT_FOUND`), missing structural tracking arrays (`ORPHANED_PAGE`), or empty placeholder markdown (`EMPTY_TEXT_OR_LINK`).
* **⚙️ Dynamic Configuration Matrix:** Highly adaptive out of the box. Define custom document extensions (`.mdx`, `.markdoc`) and registry rules directly in a local `thoth.config.ts`.
* **🤖 Machine Sympathetic:** Out-of-the-box `--json` execution stream maps aggregate diagnostics directly into LLM agent semantic tools.
* **🪶 Zero Dependencies:** Compiled entirely against native runtime binaries with zero external package bloat.

---

## Architecture Overview

`thoth` runs your validation logic across three high-efficiency execution phases:

1. **`index` Phase:** Concurrent, parallel reading of all target files to populate a lightweight in-memory metadata `catalog` mapping global heading slugs and custom metrics.
2. **`validate` Phase:** Per-file stream processing (e.g., verifying local syntax rules, validating inline frontmatter attributes, or cross-referencing heading hashes against the global catalog map).
3. **`afterValidate` Phase:** A synchronous workspace post-processing hook designed for architectural checks—such as scanning for missing config blueprints or identifying orphaned files across the directory tree.

---

## Usage

Run `thoth` instantly against any documentation directory with `bunx` (zero permanent install required):

```bash
bunx @susyabashti/thoth@latest ./docs

```

### Command Line Flags

| Flag | Impact |
| --- | --- |
| `--json` | Switches output to machine-readable JSON payloads. |
| `--pretty` | Formats the `--json` output with clean structural indents. |
| `--quiet` | Suppresses successful validation entries, outputting failures exclusively. |
| `--plain` | Disables ANSI terminal color sequences for raw, clean log piping. |
| `--ignore-errors` | Forces a successful exit code `0` even if structural flaws are found. |

---

## Custom Configuration

To scale your workflow, drop a `thoth.config.ts` file into your project root. This file allows you to override default target criteria or customize the plugin chain:

```typescript
import type { ThothConfig } from "@susyabashti/thoth/types";
import { linksPlugin } from "@susyabashti/thoth/plugins/links";

const config: ThothConfig = {
  options: {
    extensions: [".md", ".mdx"], // File extensions to scan
    configFiles: ["meta.json"],  // Config files to capture
  },
  plugins: [
    linksPlugin() // Active plugins array
  ]
};

export default config;

```
