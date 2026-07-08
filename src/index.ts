#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join, dirname, resolve, isAbsolute, relative } from "node:path";

// --- Configuration & Types ---

type BrokenLinkType =
  "FILE_NOT_FOUND" | "HEADING_NOT_FOUND" | "EMPTY_TEXT_OR_LINK";

interface BrokenLink {
  text: string;
  href: string;
  line: number;
  type: BrokenLinkType;
}

interface ScanResult {
  absolutePath: string; // <-- Added explicit separation
  relativePath: string; // <-- Added explicit separation
  brokenLinks: BrokenLink[];
  missingFrontmatter: string[];
}

interface FileMetadata {
  absolutePath: string;
  headings: string[];
  title?: string;
  description?: string;
}

// --- CLI Arguments Parsers ---
const args = process.argv.slice(2);
const isJsonMode = args.includes("--json");
const isPlainMode = args.includes("--plain");
const ignoreErrors = args.includes("--ignore-errors");
const isQuietMode = args.includes("--quiet");
const isPretty = args.includes("--pretty");
const targetDir =
  args.find((arg) => !arg.startsWith("-") && !arg.startsWith("/")) || ".";

// --- Color Helpers ---
const useColor =
  !Bun.env.NO_COLOR && Bun.env.TERM !== "dumb" && !isJsonMode && !isPlainMode;
const ESC = "\x1b[";
const R = useColor ? `${ESC}0m` : "";
const G = useColor ? `${ESC}32m` : "";
const RED = useColor ? `${ESC}31m` : "";
const YEL = useColor ? `${ESC}33m` : "";
const BOLD = useColor ? `${ESC}1m` : "";
const DIM = useColor ? `${ESC}2m` : "";
const BG_RED = useColor ? `${ESC}41;37;1m` : "";
const BG_GREEN = useColor ? `${ESC}42;30;1m` : "";

async function indexFileContent(absolutePath: string): Promise<FileMetadata> {
  const content = await Bun.file(absolutePath).text();
  const lines = content.split("\n");
  const headings: string[] = [];
  let title: string | undefined = undefined;
  let description: string | undefined = undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      const cleanSlug = trimmed
        .replace(/^#+\s+/, "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push(cleanSlug);
    }
    if (trimmed.startsWith("title:")) {
      title = trimmed
        .replace(/^title:\s*/, "")
        .replace(/['"]/g, "")
        .toLowerCase();
    }
    if (trimmed.startsWith("description:")) {
      description = trimmed
        .replace(/^description:\s*/, "")
        .replace(/['"]/g, "")
        .toLowerCase();
    }
  }

  return { absolutePath, headings, title, description };
}

const EXTENSIONS = [".md", ".mdx", "/index.md", "/index.mdx"];

async function getReferenceValidationError(
  href: string,
  currentFilePath: string,
  absoluteTargetDir: string,
  catalog: Map<string, FileMetadata>,
): Promise<BrokenLinkType | null> {
  const [pathPart, hashPart] = href.split("#");
  const cleanHref = decodeURIComponent(pathPart || "");
  const targetHash = hashPart
    ? decodeURIComponent(hashPart).toLowerCase()
    : null;

  let targetPath = "";

  if (!cleanHref) {
    targetPath = currentFilePath;
  } else {
    targetPath = isAbsolute(cleanHref)
      ? resolve(
          absoluteTargetDir,
          cleanHref.startsWith("/") ? cleanHref.slice(1) : cleanHref,
        )
      : resolve(dirname(currentFilePath), cleanHref);

    if (!(await Bun.file(targetPath).exists())) {
      let foundExt = false;
      for (const ext of EXTENSIONS) {
        const altPath = resolve(dirname(currentFilePath), cleanHref + ext);
        if (await Bun.file(altPath).exists()) {
          targetPath = altPath;
          foundExt = true;
          break;
        }
      }
      if (!foundExt) return "FILE_NOT_FOUND";
    }
  }

  if (!targetHash) return null;

  const hasHeading =
    catalog.get(targetPath)?.headings.includes(targetHash) ?? false;
  return hasHeading ? null : "HEADING_NOT_FOUND";
}

const LINK_REGEX =
  /(?<!!)\[([^\]]*)\]\((?!(?:https?:|http:|mailto:|ftp:|tel:))([^)\s]*)(?:\s+"[^"]*")?\)/g;

async function scanFileReferences(
  file: string,
  absoluteTargetDir: string,
  catalog: Map<string, FileMetadata>,
): Promise<ScanResult> {
  const content = await Bun.file(file).text();
  const lines = content.split("\n");
  const brokenLinks: BrokenLink[] = [];
  const missingFrontmatter: string[] = [];

  // --- Validate Frontmatter ---
  const meta = catalog.get(file);
  if (!meta?.title) missingFrontmatter.push("title");
  if (!meta?.description) missingFrontmatter.push("description");

  // --- Validate Links ---
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText || lineText.trim().length === 0) continue;

    let match;
    LINK_REGEX.lastIndex = 0;
    while ((match = LINK_REGEX.exec(lineText)) !== null) {
      const [_, text, href] = match;
      if (!href || !text) {
        brokenLinks.push({
          text: text || "",
          href: href || "",
          line: i + 1,
          type: "EMPTY_TEXT_OR_LINK",
        });
        continue;
      }

      const validationError = await getReferenceValidationError(
        href,
        file,
        absoluteTargetDir,
        catalog,
      );

      if (validationError) {
        brokenLinks.push({ text, href, line: i + 1, type: validationError });
      }
    }
  }

  const rawRelative = relative(process.cwd(), file);
  const formattedRelative = rawRelative.startsWith(".")
    ? rawRelative
    : `./${rawRelative}`;

  return {
    absolutePath: resolve(file),
    relativePath: formattedRelative,
    brokenLinks,
    missingFrontmatter,
  };
}

function reportFileResult(result: ScanResult): number {
  const { relativePath, brokenLinks, missingFrontmatter } = result;
  const totalErrors = brokenLinks.length + missingFrontmatter.length;

  if (isJsonMode) return totalErrors;

  if (totalErrors === 0) {
    if (!isQuietMode) {
      console.log(`${G}✔ PASSED${R} ${DIM}${relativePath}${R}`);
    }
    return 0;
  }

  console.log(`${RED}✘ FAILED${R} ${BOLD}${relativePath}${R}`);

  for (const field of missingFrontmatter) {
    console.log(
      `  ${RED}├── Frontmatter Missing:${R} [${field}] metadata key.`,
    );
  }

  for (const link of brokenLinks) {
    switch (link.type) {
      case "EMPTY_TEXT_OR_LINK":
        console.log(
          `  ${RED}└── Line ${link.line}:${R} Empty markdown link placeholder found: []().`,
        );
        break;

      case "HEADING_NOT_FOUND":
        console.log(
          `  ${YEL}└── Line ${link.line}:${R} [${link.text}](${link.href}) -> Dead heading anchor link resource.`,
        );
        break;

      case "FILE_NOT_FOUND":
        console.log(
          `  ${RED}└── Line ${link.line}:${R} [${link.text}](${RED}${link.href}${R}) -> Dead file reference path target.`,
        );
        break;
      default:
        throw new Error(
          `Unhandled link validation type: ${JSON.stringify(link)}`,
        );
    }
  }
  console.log();
  return totalErrors;
}

async function getMarkdownFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const dir = queue.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))
      ) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function formatHighResDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms >= 1) return `${ms.toFixed(2)}ms`;
  const microseconds = ms * 1000;
  if (microseconds >= 1) return `${microseconds.toFixed(2)}μs`;
  return `${(microseconds * 1000).toFixed(2)}ns`;
}

type Output = {
  absoluteTargetDir: string;
  relativeTargetDir: string;
  failedFiles: ScanResult[];
  executionError?: string;
  stats: {
    totalFilesScanned: number;
    totalFailed: number;
    totalBroken: { links: number; frontmatter: number };
    duration: string;
    durationMs: string;
    timestamp: string;
  };
};

async function main() {
  const absoluteTargetDir = resolve(targetDir);
  const rawRelativeTarget = relative(process.cwd(), absoluteTargetDir);
  const relativeTargetDir =
    rawRelativeTarget === ""
      ? "."
      : rawRelativeTarget.startsWith(".")
        ? rawRelativeTarget
        : `./${rawRelativeTarget}`;

  const startTime = performance.now();
  const timestamp = new Date().toLocaleTimeString();

  if (!isJsonMode) {
    console.log(`\n ${BG_GREEN} SCAN ${R} ${DIM}${absoluteTargetDir}${R}\n`);
  }

  const files = await getMarkdownFiles(absoluteTargetDir);
  const totalFilesScanned = files.length;

  const indexedData = await Promise.all(files.map(indexFileContent));
  const catalog = new Map<string, FileMetadata>(
    indexedData.map((data) => [data.absolutePath, data]),
  );
  const results = await Promise.all(
    files.map((file) => scanFileReferences(file, absoluteTargetDir, catalog)),
  );

  const failedFiles = results.filter((result) => reportFileResult(result) > 0);
  const totalFailed = failedFiles.length;
  const totalBroken = failedFiles.reduce(
    (acc, result) => ({
      links: acc.links + result.brokenLinks.length,
      frontmatter: acc.frontmatter + result.missingFrontmatter.length,
    }),
    { links: 0, frontmatter: 0 },
  );

  const rawDurationMs = performance.now() - startTime;
  const duration = formatHighResDuration(rawDurationMs);

  if (isJsonMode) {
    const output: Output = {
      absoluteTargetDir,
      relativeTargetDir,
      failedFiles,
      stats: {
        totalFailed,
        totalBroken,
        totalFilesScanned,
        durationMs: rawDurationMs.toFixed(4),
        duration,
        timestamp,
      },
    };
    console.log(
      isPretty ? JSON.stringify(output, null, 2) : JSON.stringify(output),
    );
    return (totalBroken.links === 0 && totalBroken.frontmatter === 0) ||
      ignoreErrors
      ? 0
      : 1;
  }

  const passedCount = totalFilesScanned - totalFailed;

  console.log(
    `${BOLD}  Doc Files${R}      ${totalFailed > 0 ? `${RED}${totalFailed} failed${R} | ` : ""}${G}${passedCount} passed${R} (${totalFilesScanned})`,
  );
  console.log(
    `${BOLD}  References${R}     ${totalBroken.links > 0 ? `${RED}${totalBroken.links} dead links${R}` : `${G}all healthy${R}`}`,
  );
  console.log(
    `${BOLD}  Frontmatter${R}    ${totalBroken.frontmatter > 0 ? `${RED}${totalBroken.frontmatter} missing frontmatter${R}` : `${G}all healthy${R}`}`,
  );
  console.log(`${BOLD}  Start at${R}       ${timestamp}`);
  console.log(`${BOLD}  Duration${R}       ${duration}\n`);

  if (totalBroken.links === 0 && totalBroken.frontmatter === 0) {
    console.log(
      ` ${BG_GREEN} DONE ${R} ${G}${BOLD}All markdown links are structurally solid!${R}\n`,
    );
  } else {
    console.log(
      ` ${BG_RED} FAIL ${R} ${RED}${BOLD}Found broken markdown references.${R}\n`,
    );
  }

  return (totalBroken.links === 0 && totalBroken.frontmatter === 0) ||
    ignoreErrors
    ? 0
    : 1;
}

main().then((code) => {
  process.exitCode = code;
});
