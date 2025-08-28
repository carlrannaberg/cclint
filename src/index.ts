/**
 * CCLint SDK - Programmatic API for Claude Code project validation
 * 
 * This module provides the main SDK entry point for CCLint, enabling developers
 * to integrate Claude Code project validation directly into their applications,
 * build tools, and custom scripts without shell execution overhead.
 * 
 * @example
 * ```typescript
 * import CClint, { lintProject } from 'cclint';
 * 
 * // Using the high-level SDK class
 * const linter = new CClint();
 * const results = await linter.lintProject('./my-claude-project');
 * 
 * // Using core functions directly
 * const results = await lintProject('./my-claude-project', {
 *   parallel: true,
 *   concurrency: 20,
 *   verbose: true
 * });
 * ```
 * 
 * @author CCLint Team
 * @version 1.0.0
 */

// High-level SDK class (default export)
export { CClint } from './lib/sdk.js';
export { CClint as default } from './lib/sdk.js';

// Core functions for direct usage
export {
  lintProject,
  lintFiles,
  loadProjectConfig,
  detectProject
} from './lib/core.js';

// Individual linters for advanced usage
export {
  AgentsLinter,
  CommandsLinter,
  SettingsLinter,
  ClaudeMdLinter
} from './linters/index.js';

// Reporters for custom output formatting
export {
  ConsoleReporter,
  JsonReporter,
  MarkdownReporter
} from './reporters/index.js';

// Configuration and utilities
export {
  loadConfig,
  validateConfig,
  mergeWithDefaults
} from './lib/config.js';

export {
  findProjectRoot,
  detectProjectInfo
} from './lib/project-detection.js';

export {
  sanitizePath,
  isPathSafe,
  calculateSummary,
  PathSecurityError
} from './lib/utils.js';

// TypeScript types for SDK consumers
export type {
  // Core types
  CclintConfig,
  LintOptions,
  LintResult,
  LintSummary,
  EnhancedLintSummary,
  ProjectInfo,
  FrontmatterData,
  
  // SDK-specific types  
  SDKLintOptions,
  
  // Linter and configuration types
  BaseLinter,
  AgentFrontmatter,
  CommandFrontmatter,
  ClaudeSettings,
  ClaudeMdStructure,
  CclintConfigExport
} from './types/index.js';

// Schema and validation exports
export {
  getAgentSchema,
  getCommandSchema,
  getSettingsSchema,
  KNOWN_CLAUDE_TOOLS,
  VALID_CLAUDE_COLORS,
  ModelSchema
} from './lib/schemas.js';