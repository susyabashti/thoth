import type { ThothPlugin, ValidationError } from "../types";
import { basename, dirname, resolve, relative } from "node:path";

export const pagesCoveragePlugin = (): ThothPlugin => ({
  name: "require-pages-coverage",

  async afterValidate({ files, configs, config }) {
    const errors: ValidationError[] = [];

    // 1. Check if any structural configuration maps were discovered during engine initialization
    if (!configs || configs.length === 0) {
      return [];
    }

    // Grab configured document extensions to slice file slugs dynamically
    const allowedExtensions = config.extensions || [".md", ".mdx"];

    // 2. Loop directly through the pre-discovered config arrays (No extra disk I/O)
    for (const metaPath of configs) {
      const metaFile = Bun.file(metaPath);
      const currentDir = dirname(metaPath);

      const rawRelative = relative(process.cwd(), metaPath);
      const relativeDir = relative(process.cwd(), currentDir);
      const relativePath = rawRelative.startsWith(".")
        ? rawRelative
        : `./${rawRelative}`;

      let metaContent;
      try {
        metaContent = await metaFile.json();
      } catch {
        errors.push({
          type: "MALFORMED_META_JSON",
          absolutePath: metaPath,
          message: `Workspace Check: Failed to parse JSON.`,
        });
        continue;
      }

      if (!metaContent || !("pages" in metaContent)) {
        errors.push({
          type: "MISSING_META_JSON_FIELD",
          absolutePath: metaPath,
          relativePath,
          message: `Content schema is missing the required 'pages' array attribute field.`,
        });
        continue;
      }

      const pages = Array.isArray(metaContent.pages) ? metaContent.pages : [];

      // Check for illegal indices inside navigation mapping layout
      if (
        pages.includes("index") ||
        allowedExtensions.some((ext) => pages.includes(`index${ext}`))
      ) {
        errors.push({
          type: "INDEX_MUST_NOT_BE_INCLUDED",
          absolutePath: metaPath,
          relativePath,
          message: `The 'index' page must not be included in the 'pages' array.`,
        });
      }

      // 3. Filter memory data arrays for docs located purely within this subdirectory context
      const localSlugs = files
        .filter((f) => dirname(resolve(f)) === currentDir)
        .map((f) => {
          const base = basename(f);
          // Dynamically strip whatever custom extension matched this document
          const matchedExt = allowedExtensions.find((ext) =>
            base.endsWith(ext),
          );
          return matchedExt ? base.slice(0, -matchedExt.length) : base;
        })
        .filter((slug) => slug !== "index");

      // 4. Assert that every disk asset has explicit listing keys configured
      for (const slug of localSlugs) {
        if (!pages.includes(slug)) {
          errors.push({
            type: "ORPHANED_PAGE",
            absolutePath: metaPath,
            relativePath,
            message: `File '${slug}' exists physically in '${relativeDir}' directory but is missing from its local 'pages' configuration array.`,
          });
        }
      }
    }

    return errors;
  },
});
