import type { ThothPlugin, ValidationError } from "../types";
import { dirname, resolve, isAbsolute } from "node:path";

const LINK_REGEX =
  /(?<!!)\[([^\]]*)\]\((?!(?:https?:|http:|mailto:|ftp:|tel:))([^)\s]*)(?:\s+"[^"]*")?\)/g;

export const linksPlugin = (): ThothPlugin => ({
  name: "links",
  index(absolutePath, content) {
    const headings: string[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        const cleanSlug = trimmed
          .replace(/^#+\s+/, "")
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        headings.push(cleanSlug);
      }
    }
    return { headings };
  },
  async validate(absolutePath, content, context) {
    const { absoluteTargetDir, catalog, config } = context;
    const lines = content.split("\n");
    const errors: ValidationError[] = [];

    // Dynamically grab configured extensions, appending direct directory index lookups
    const allowedExtensions = config.extensions || [".md", ".mdx"];
    const lookups = [
      ...allowedExtensions,
      ...allowedExtensions.map((ext) => `/index${ext}`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText || lineText.trim().length === 0) continue;

      let match;
      LINK_REGEX.lastIndex = 0;
      while ((match = LINK_REGEX.exec(lineText)) !== null) {
        const [_, text, href] = match;
        const line = i + 1;

        if (!href || !text) {
          errors.push({
            type: "EMPTY_TEXT_OR_LINK",
            line,
            text: text || "",
            href: href || "",
            message: `Empty markdown link placeholder found: []().`,
          });
          continue;
        }

        const [pathPart, hashPart] = href.split("#");
        const cleanHref = decodeURIComponent(pathPart || "");
        const targetHash = hashPart
          ? decodeURIComponent(hashPart).toLowerCase()
          : null;

        let targetPath = !cleanHref
          ? absolutePath
          : isAbsolute(cleanHref)
            ? resolve(
                absoluteTargetDir,
                cleanHref.startsWith("/") ? cleanHref.slice(1) : cleanHref,
              )
            : resolve(dirname(absolutePath), cleanHref);

        if (cleanHref && !(await Bun.file(targetPath).exists())) {
          let foundExt = false;
          for (const ext of lookups) {
            const altPath = isAbsolute(cleanHref)
              ? resolve(
                  absoluteTargetDir,
                  cleanHref.startsWith("/") ? cleanHref.slice(1) : cleanHref,
                ) + ext
              : resolve(dirname(absolutePath), cleanHref + ext);

            if (await Bun.file(altPath).exists()) {
              targetPath = altPath;
              foundExt = true;
              break;
            }
          }
          if (!foundExt) {
            errors.push({
              type: "FILE_NOT_FOUND",
              line,
              text,
              href,
              message: `[${text}](${href}) -> Dead file reference path target.`,
            });
            continue;
          }
        }

        if (targetHash) {
          const hasHeading =
            catalog.get(targetPath)?.headings.includes(targetHash) ?? false;
          if (!hasHeading) {
            errors.push({
              type: "HEADING_NOT_FOUND",
              line,
              text,
              href,
              message: `[${text}](${href}) -> Dead heading anchor link resource.`,
            });
          }
        }
      }
    }
    return errors;
  },
});
