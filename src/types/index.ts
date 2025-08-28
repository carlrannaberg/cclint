/**
 * Core type definitions for cclint
 */

import type { z } from 'zod';

export interface LintResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  missingFields: string[];
  customSchemaErrors?: string[];
}

export interface ProjectInfo {
  root: string;
  hasGit: boolean;
  hasClaudeDir: boolean;
  hasPackageJson: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  projectName?: string;
  cclintConfig?: CclintConfig;
}

export interface LintOptions {
  root?: string;
  quiet?: boolean;
  verbose?: boolean;
  format?: 'console' | 'json' | 'markdown';
  outputFile?: string;
  failOn?: 'error' | 'warning' | 'suggestion';
  customSchemas?: boolean;
  parallel?: boolean;
  concurrency?: number;
  followSymlinks?: boolean;
}

/**
 * SDK-specific linting options that extend the base LintOptions
 * but exclude CLI-specific properties like format and outputFile
 */
export interface SDKLintOptions extends Omit<LintOptions, 'format' | 'outputFile' | 'root'> {
  // Advanced filtering options
  includeFiles?: string[];
  excludeFiles?: string[];
  
  // SDK-specific options
  returnRawResults?: boolean;
  includeMetadata?: boolean;
}

/**
 * Generic frontmatter data structure
 */
export interface FrontmatterData {
  [key: string]: string | number | boolean | string[] | undefined | null;
}

/**
 * Configuration for custom Zod schema extensions
 */
export interface CclintConfig {
  /**
   * Custom schema extensions for agents
   */
  agentSchema?: {
    /**
     * Additional fields to allow in agent frontmatter
     */
    extend?: Record<string, z.ZodType>;
    /**
     * Override the entire schema (advanced)
     */
    override?: z.ZodType;
    /**
     * Validation rules for custom fields
     */
    customValidation?: (data: FrontmatterData) => string[];
  };
  
  /**
   * Custom schema extensions for commands
   */
  commandSchema?: {
    extend?: Record<string, z.ZodType>;
    override?: z.ZodType;
    customValidation?: (data: FrontmatterData) => string[];
  };
  
  /**
   * Custom schema extensions for settings.json
   */
  settingsSchema?: {
    extend?: Record<string, z.ZodType>;
    override?: z.ZodType;
    customValidation?: (data: Record<string, unknown>) => string[];
  };
  
  /**
   * Custom validation rules for CLAUDE.md
   */
  claudeMdRules?: {
    requiredSections?: string[];
    recommendedSections?: string[];
    customValidation?: (content: string, sections: string[]) => string[];
  };
  
  /**
   * Global linting rules
   */
  rules?: {
    /**
     * Severity level for unknown fields
     */
    unknownFields?: 'error' | 'warning' | 'suggestion' | 'ignore';
    /**
     * Enable strict mode validation
     */
    strict?: boolean;
    /**
     * Custom file patterns to lint
     */
    includePatterns?: string[];
    /**
     * File patterns to exclude from linting
     */
    excludePatterns?: string[];
  };
}

/**
 * Type for configuration file exports (JS/TS config files)
 */
export type CclintConfigExport = CclintConfig | (() => CclintConfig) | (() => Promise<CclintConfig>);

export interface LintSummary {
  totalFiles: number;
  validFiles: number;
  totalErrors: number;
  totalWarnings: number;
  totalSuggestions: number;
  duration: number;
  results: LintResult[];
}

/**
 * Enhanced lint summary with optional metadata for SDK usage
 */
export interface EnhancedLintSummary extends LintSummary {
  metadata?: {
    duration: number;
    nodeVersion: string;
    cclintVersion: string;
    projectRoot: string;
    configPath?: string;
    linterCount?: number;
    fileCount?: number;
    parallelExecution: boolean;
    concurrency: number;
  };
}

export interface BaseLinter {
  name: string;
  description: string;
  lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]>;
}

export interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string | string[];
  'allowed-tools'?: string | string[];
  model?: string;
  color?: string;
  [key: string]: unknown;
}

export interface CommandFrontmatter {
  'allowed-tools'?: string;
  'argument-hint'?: string;
  description?: string;
  model?: string;
}

export interface ClaudeSettings {
  hooks?: {
    [eventType: string]: Array<{
      matcher: string;
      hooks: Array<{
        type: string;
        command: string;
      }>;
    }>;
  };
  [key: string]: unknown;
}

export interface ClaudeMdStructure {
  hasTitle: boolean;
  hasDescription: boolean;
  hasNavigation: boolean;
  hasBuildSection: boolean;
  hasSubagentsSection: boolean;
  hasStyleSection: boolean;
  hasTestingSection: boolean;
  hasConfigSection: boolean;
  sections: string[];
}