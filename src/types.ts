export interface FileMetadata {
  absolutePath: string;
  headings: string[];
  title?: string;
  description?: string;
  custom?: Record<string, any>;
}

export interface ValidationError {
  type: string;
  line?: number;
  text?: string;
  href?: string;
  absolutePath?: string;
  relativePath?: string;
  message: string;
}

export interface ScanResult {
  absolutePath: string;
  relativePath: string;
  errors: ValidationError[];
}

export interface PluginContext {
  absoluteTargetDir: string;
  catalog: Map<string, FileMetadata>;
  files: string[];
  configs: string[];
  config: NonNullable<ThothConfig["options"]>;
}

export interface ThothPlugin {
  name: string;
  index?(
    absolutePath: string,
    content: string,
  ): Promise<Partial<FileMetadata>> | Partial<FileMetadata>;
  validate?(
    absolutePath: string,
    content: string,
    context: PluginContext,
  ): Promise<ValidationError[]> | ValidationError[];
  afterValidate?(
    context: PluginContext,
  ): Promise<ValidationError[]> | ValidationError[];
}

export interface ThothConfig {
  plugins?: ThothPlugin[];
  options?: {
    extensions?: string[]; // e.g., [".md", ".mdx"]
    configFiles?: string[]; // e.g., ["meta.json"]
    [key: string]: any;
  };
}
