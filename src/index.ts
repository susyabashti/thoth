#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type {
  FileMetadata,
  PluginContext,
  ScanResult,
  ValidationError,
} from "./types";
import { loadConfig } from "./config";

const args = process.argv.slice(2);
const isJsonMode = args.includes("--json");
const ignoreErrors = args.includes("--ignore-errors");
const isQuietMode = args.includes("--quiet");
const isPretty = args.includes("--pretty");
const targetDir =
  args.find((arg) => !arg.startsWith("-") && !arg.startsWith("/")) || ".";

const useColor = !Bun.env.NO_COLOR && Bun.env.TERM !== "dumb" && !isJsonMode;
const ESC = "\x1b[";
const R = useColor ? `${ESC}0m` : "";
const G = useColor ? `${ESC}32m` : "";
const RED = useColor ? `${ESC}31m` : "";
const YEL = useColor ? `${ESC}33m` : "";
const BOLD = useColor ? `${ESC}1m` : "";
const DIM = useColor ? `${ESC}2m` : "";
const BG_RED = useColor ? `${ESC}41;37;1m` : "";
const BG_GREEN = useColor ? `${ESC}42;30;1m` : "";

async function getTargetFiles(
  rootDir: string,
  extensions: string[],
  configFiles: string[],
): Promise<{ docs: string[]; configs: string[] }> {
  const docs: string[] = [];
  const configs: string[] = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const dir = queue.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        // Dynamic lookups replacing string literals
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          docs.push(fullPath);
        } else if (configFiles.includes(entry.name)) {
          configs.push(fullPath);
        }
      }
    }
  }
  return { docs, configs };
}

function formatHighResDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  return `${(ms * 1000).toFixed(2)}μs`;
}

function reportFileResult(result: ScanResult): number {
  if (isJsonMode) return result.errors.length;
  if (result.errors.length === 0) {
    if (!isQuietMode)
      console.log(`${G}✔ PASSED${R} ${DIM}${result.relativePath}${R}`);
    return 0;
  }

  console.log(`${RED}✘ FAILED${R} ${BOLD}${result.relativePath}${R}`);
  for (const err of result.errors) {
    const linePrefix = err.line ? `Line ${err.line}: ` : "";
    const color = err.type === "HEADING_NOT_FOUND" ? YEL : RED;
    console.log(`  ${color}└── ${linePrefix}${R}${err.message}`);
  }
  console.log();
  return result.errors.length;
}

async function main() {
  const absoluteTargetDir = resolve(targetDir);
  const startTime = performance.now();
  const timestamp = new Date().toLocaleTimeString();

  // Load custom workspace config and fallback defaults safely
  const config = await loadConfig();
  const plugins = config.plugins;

  if (!isJsonMode) {
    console.log(`\n ${BG_GREEN} SCAN ${R} ${DIM}${absoluteTargetDir}${R}\n`);
  }

  // 1. One-pass directory crawl using configuration-driven criteria matrices
  const { docs, configs } = await getTargetFiles(
    absoluteTargetDir,
    config.options.extensions!,
    config.options.configFiles!,
  );

  const catalog = new Map<string, FileMetadata>();

  // 2. Lifecycle Phase 1: Distributed Concurrent Index Processing Engine Loops
  await Promise.all(
    docs.map(async (file) => {
      const content = await Bun.file(file).text();
      const meta: FileMetadata = { absolutePath: file, headings: [] };

      for (const plugin of plugins) {
        if (plugin.index) {
          const updates = await plugin.index(file, content);
          Object.assign(meta, updates);
        }
      }
      catalog.set(file, meta);
    }),
  );

  // Initialize runtime execution dependency injection graph parameters
  const context: PluginContext = {
    absoluteTargetDir,
    catalog,
    files: docs,
    configs,
    config: config.options,
  };

  // 3. Lifecycle Phase 2: Per-File Assert Validation Logic Loops
  const results: ScanResult[] = await Promise.all(
    docs.map(async (file) => {
      const content = await Bun.file(file).text();
      const errors: ValidationError[] = [];

      for (const plugin of plugins) {
        if (plugin.validate) {
          const out = await plugin.validate(file, content, context);
          errors.push(...out);
        }
      }

      const rawRelative = relative(process.cwd(), file);
      return {
        absolutePath: file,
        relativePath: rawRelative.startsWith(".")
          ? rawRelative
          : `./${rawRelative}`,
        errors,
      };
    }),
  );

  // 4. Lifecycle Phase 3: Synchronous Global / Workspace Post-Validation Hooks
  const globalErrors: ValidationError[] = [];
  for (const plugin of plugins) {
    if (plugin.afterValidate) {
      const out = await plugin.afterValidate(context);
      globalErrors.push(...out);
    }
  }

  // 5. Aggregate Analytics Diagnostics & Error Consolidation Reports
  const failedFiles = results.filter((res) => reportFileResult(res) > 0);
  const totalFileErrors = failedFiles.reduce(
    (acc, res) => acc + res.errors.length,
    0,
  );
  const totalErrors = totalFileErrors + globalErrors.length;

  const rawDurationMs = performance.now() - startTime;
  const duration = formatHighResDuration(rawDurationMs);

  // Output Global Architecture Blockers directly to CLI Channel
  if (globalErrors.length > 0 && !isJsonMode) {
    console.log(`${RED}${BOLD}✘ GLOBAL WORKSPACE ERRORS${R}`);
    for (const err of globalErrors) {
      console.log(`  ${RED}└── ${R}${err.message}`);
    }
    console.log();
  }

  // 6. Output Pipeline Target Handlers (JSON vs Human Readout Terminal Stream)
  if (isJsonMode) {
    const output = {
      absoluteTargetDir,
      failedFiles,
      globalErrors,
      stats: {
        totalFilesScanned: docs.length,
        totalFailed: failedFiles.length + (globalErrors.length > 0 ? 1 : 0),
        totalErrors,
        durationMs: rawDurationMs.toFixed(4),
        duration,
        timestamp,
      },
    };
    console.log(
      isPretty ? JSON.stringify(output, null, 2) : JSON.stringify(output),
    );
    return totalErrors === 0 || ignoreErrors ? 0 : 1;
  }

  const passedCount = docs.length - failedFiles.length;
  console.log(
    `${BOLD}  Doc Files${R}      ${failedFiles.length > 0 ? `${RED}${failedFiles.length} failed${R} | ` : ""}${G}${passedCount} passed${R} (${docs.length})`,
  );
  console.log(
    `${BOLD}  Issues${R}         ${totalErrors > 0 ? `${RED}${totalErrors} errors found${R}` : `${G}all healthy${R}`}`,
  );
  console.log(`${BOLD}  Duration${R}       ${duration}\n`);

  if (totalErrors === 0) {
    console.log(
      ` ${BG_GREEN} DONE ${R} ${G}${BOLD}All validations clean!${R}\n`,
    );
    return 0;
  } else {
    console.log(
      ` ${BG_RED} FAIL ${R} ${RED}${BOLD}Validation rules failed.${R}\n`,
    );
    return ignoreErrors ? 0 : 1;
  }
}

main().then((code) => {
  process.exitCode = code;
});
