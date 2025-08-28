/**
 * High-level SDK class for CCLint
 * 
 * This class provides a convenient, object-oriented interface to CCLint's
 * core functionality, making it easy to integrate into applications and
 * build tools.
 */

import { lintProject, lintFiles, loadProjectConfig, detectProject } from './core.js';
import { AgentsLinter } from '../linters/agents.js';
import { CommandsLinter } from '../linters/commands.js';
import { SettingsLinter } from '../linters/settings.js';
import { ClaudeMdLinter } from '../linters/claude-md.js';
import type { 
  CclintConfig, 
  SDKLintOptions, 
  LintSummary, 
  EnhancedLintSummary,
  LintResult, 
  LintOptions,
  ProjectInfo
} from '../types/index.js';

/**
 * Main SDK class providing high-level access to CCLint functionality
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const linter = new CClint();
 * const results = await linter.lintProject();
 * 
 * // With custom configuration
 * const customConfig = { rules: { strict: true } };
 * const linter = new CClint(customConfig);
 * const results = await linter.lintProject('./my-project');
 * 
 * // Lint specific file types
 * const agentResults = await linter.lintAgents('./my-project');
 * ```
 */
export class CClint {
  constructor(private config?: CclintConfig) {}

  /**
   * Lint an entire Claude Code project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @param options - SDK-specific linting options
   * @returns Promise resolving to lint summary
   */
  async lintProject(
    projectRoot?: string, 
    options?: SDKLintOptions
  ): Promise<LintSummary | EnhancedLintSummary> {
    const root = projectRoot || process.cwd();
    return await lintProject(root, options, this.config);
  }

  /**
   * Lint specific files
   * 
   * @param files - Array of file paths to lint
   * @param options - SDK-specific linting options
   * @returns Promise resolving to lint summary
   */
  async lintFiles(
    files: string[], 
    options?: SDKLintOptions
  ): Promise<LintSummary | EnhancedLintSummary> {
    return await lintFiles(files, options, this.config);
  }

  /**
   * Lint only agent files in the project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @param options - SDK-specific linting options
   * @returns Promise resolving to array of lint results for agent files
   */
  async lintAgents(
    projectRoot?: string, 
    options?: SDKLintOptions
  ): Promise<LintResult[]> {
    const linter = new AgentsLinter();
    const lintOptions = this.normalizeOptions(options);
    const projectInfo = await detectProject(projectRoot);
    return await linter.lint(projectRoot || process.cwd(), lintOptions, projectInfo);
  }

  /**
   * Lint only command files in the project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @param options - SDK-specific linting options
   * @returns Promise resolving to array of lint results for command files
   */
  async lintCommands(
    projectRoot?: string, 
    options?: SDKLintOptions
  ): Promise<LintResult[]> {
    const linter = new CommandsLinter();
    const lintOptions = this.normalizeOptions(options);
    const projectInfo = await detectProject(projectRoot);
    return await linter.lint(projectRoot || process.cwd(), lintOptions, projectInfo);
  }

  /**
   * Lint only settings files in the project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @param options - SDK-specific linting options
   * @returns Promise resolving to array of lint results for settings files
   */
  async lintSettings(
    projectRoot?: string, 
    options?: SDKLintOptions
  ): Promise<LintResult[]> {
    const linter = new SettingsLinter();
    const lintOptions = this.normalizeOptions(options);
    const projectInfo = await detectProject(projectRoot);
    return await linter.lint(projectRoot || process.cwd(), lintOptions, projectInfo);
  }

  /**
   * Lint only CLAUDE.md/AGENTS.md files in the project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @param options - SDK-specific linting options
   * @returns Promise resolving to array of lint results for documentation files
   */
  async lintClaudeMd(
    projectRoot?: string, 
    options?: SDKLintOptions
  ): Promise<LintResult[]> {
    const linter = new ClaudeMdLinter();
    const lintOptions = this.normalizeOptions(options);
    const projectInfo = await detectProject(projectRoot);
    return await linter.lint(projectRoot || process.cwd(), lintOptions, projectInfo);
  }

  /**
   * Load configuration for the specified project
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @returns Promise resolving to project configuration or null if none found
   */
  async loadConfig(projectRoot?: string): Promise<CclintConfig | null> {
    return await loadProjectConfig(projectRoot);
  }

  /**
   * Detect project information and structure
   * 
   * @param projectRoot - Path to project root (defaults to current directory)
   * @returns Promise resolving to project information
   */
  async detectProject(projectRoot?: string): Promise<ProjectInfo> {
    return await detectProject(projectRoot);
  }

  /**
   * Convert SDK options to internal LintOptions format
   * 
   * @private
   * @param options - SDK options to normalize
   * @returns Normalized lint options
   */
  private normalizeOptions(options?: SDKLintOptions): LintOptions {
    return {
      quiet: options?.quiet ?? false,
      verbose: options?.verbose ?? false,
      format: 'console' as const,
      failOn: options?.failOn ?? 'error',
      customSchemas: options?.customSchemas ?? true,
      parallel: options?.parallel ?? true,
      concurrency: options?.concurrency ?? 10,
      followSymlinks: options?.followSymlinks ?? false,
    };
  }
}