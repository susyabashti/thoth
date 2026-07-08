import type { ThothPlugin, ValidationError } from "../types";

export const frontmatterPlugin = (): ThothPlugin => ({
  name: "frontmatter",
  index(absolutePath, content) {
    const lines = content.split("\n");
    let title: string | undefined;
    let description: string | undefined;

    // Fast header sweep (stops checking deep down if it encounters content blocks)
    for (const line of lines) {
      const trimmed = line.trim();
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
    return { title, description };
  },
  validate(absolutePath, content, { catalog, config }) {
    // Optional: Allow bypassing validation entirely if configured in options
    if (config.skipFrontmatterValidation) return [];

    const meta = catalog.get(absolutePath);
    const errors: ValidationError[] = [];

    if (!meta?.title) {
      errors.push({
        type: "FRONTMATTER_MISSING",
        message: "Frontmatter Missing: [title] metadata key attribute field.",
      });
    }
    if (!meta?.description) {
      errors.push({
        type: "FRONTMATTER_MISSING",
        message:
          "Frontmatter Missing: [description] metadata key attribute field.",
      });
    }
    return errors;
  },
});
