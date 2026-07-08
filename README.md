# thoth

A lightning-fast, zero-dependency structural validator for markdown workspaces, written in TypeScript and optimized for the **Bun** runtime. 

Named after the Egyptian deity of wisdom, scribes, and precise calculation, `thoth` indexes your documentation ecosystem into an in-memory structural catalog to validate file paths, heading anchors, and frontmatter integrity at native runtime speeds.

---

## The Why

LLMs are brilliant at reasoning, drafting, and architecting—but they are historically unreliable and expensive at performing "clerical" tasks. When asked to verify file integrity or cross-reference documentation links, LLMs:

* **Waste Tokens:** They perform dozens of expensive tool calls to read file structures.
* **Consume Context:** They saturate their context window with directory listings.
* **Hallucinate:** They often "guess" paths, leading to fragile documentation that breaks as soon as you move a folder.

**`thoth`** solves this by moving verification out of the agent's "brain" and into your local workspace runtime or CI/CD pipeline. It provides your agents with a clear, deterministic source of truth. When the script rejects a workflow, the agent gets a precise line-number reference and a clear error type, allowing it to focus on **building and improving** rather than searching.

---

## Key Features

* **🎯 Granular Error Classification:** Distinguishes cleanly between dead file paths (`file`), missing internal fragment hashes (`heading`), and placeholder link snippets (`empty`), giving automated workflows explicit types to act on.
* **📋 Frontmatter Enforcement:** Validates metadata presence (`title`, `description`) to ensure structural uniformity across static site generation pipelines.
* **🤖 Machine Sympathetic:** Provides a robust `--json` mode mapping complete validation metrics directly into LLM agent semantic boundaries.
* **🪶 Zero Dependencies:** Compiled entirely against native runtime binaries with zero external package bloat.

---

## Usage

Run `thoth` instantly against any documentation directory without local installation:

```bash
bunx @susyabashti/thoth ./docs
```

### Command Line Flags

| Flag | Impact |
| --- | --- |
| `--json` | Switches output to raw machine-readable JSON payloads. |
| `--pretty` | Formats the `--json` output with clean structural indents. |
| `--quiet` | Suppresses successful validation entries, outputting failures exclusively. |
| `--plain` | Disables ANSI terminal color sequences for clean raw logs. |
| `--ignore-errors` | Forces a successful exit code `0` even if structural flaws are found. |
