import { resolve } from "node:path";
import type { ThothConfig } from "./types";
import { frontmatterPlugin } from "./plugins/frontmatter";
import { linksPlugin } from "./plugins/links";
import { pagesCoveragePlugin } from "./plugins/pages-coverage";

export async function loadConfig(): Promise<Required<ThothConfig>> {
  const configPath = resolve(process.cwd(), "thoth.config.ts");

  const defaultOptions = {
    extensions: [".md", ".mdx"],
    configFiles: ["meta.json"],
  };

  const defaultPlugins = [
    frontmatterPlugin(),
    linksPlugin(),
    pagesCoveragePlugin(),
  ];

  if (await Bun.file(configPath).exists()) {
    try {
      const userConfig = await import(configPath);
      const config = userConfig.default || userConfig;
      return {
        plugins: config.plugins || defaultPlugins,
        options: { ...defaultOptions, ...config.options },
      };
    } catch (err) {
      console.error(`\x1b[31mError loading configuration file:\x1b[0m`, err);
    }
  }

  return {
    plugins: defaultPlugins,
    options: defaultOptions,
  };
}
