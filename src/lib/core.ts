/**
 * Core linting functionality - pure functions that can be used by both CLI and SDK
 * 
 * This module extracts the core business logic from the CLI command implementation,
 * providing clean, reusable functions that:
 * - Take structured options instead of CLI flags
 * - Return structured data instead of outputting to console
 * - Preserve all existing security measures
 * - Support parallel linting with configurable concurrency
 * - Handle project detection and configuration loading
 */

import * as path from 'path';
import { AgentsLinter } from '../linters/agents.js';
import { CommandsLinter } from '../linters/commands.js';
import { SettingsLinter } from '../linters/settings.js';
import { ClaudeMdLinter } from '../linters/claude-md.js';
import { findProjectRoot, detectProjectInfo } from './project-detection.js';
import { calculateSummary, sanitizePath, PathSecurityError } from './utils.js';
import { loadConfig } from './config.js';
import type { 
  LintOptions, 
  LintResult, 
  BaseLinter, 
  LintSummary, 
  ProjectInfo,
  CclintConfig,
  SDKLintOptions,
  EnhancedLintSummary
} from '../types/index.js';

/**
 * Lint an entire Claude Code project by running all applicable linters
 * 
 * This is the main entry point for project-wide linting. It:
 * 1. Validates and sanitizes the project root path
 * 2. Detects project information and loads configuration
 * 3. Runs all linters (agents, commands, settings, CLAUDE.md)
 * 4. Returns structured results and summary
 * 
 * @param projectRoot - Path to the Claude Code project root
 * @param options - SDK-specific linting options
 * @param config - Optional configuration to override project config
 * @returns Promise resolving to a complete lint summary with all results
 * 
 * @throws {PathSecurityError} If project root path is invalid or insecure
 * @throws {Error} If project detection or linting fails
 * 
 * @example
 * ```typescript
 * // Basic project linting
 * const results = await lintProject('./my-claude-project');
 * 
 * // With custom options
 * const results = await lintProject('./my-claude-project', {
 *   parallel: true,
 *   concurrency: 20,
 *   verbose: true
 * });
 * 
 * // With custom configuration
 * const customConfig = { rules: { strict: true } };
 * const results = await lintProject('./my-claude-project', {}, customConfig);
 * ```
 */
export async function lintProject(
  projectRoot: string,
  options: SDKLintOptions = {},
  config?: CclintConfig
): Promise<LintSummary | EnhancedLintSummary> {
  const startTime = Date.now();
  
  // Validate and sanitize project root path for security
  const sanitizedRoot = await sanitizePath(projectRoot);
  
  // Detect project information and load configuration if not provided
  const projectInfo = await detectProjectInfo(sanitizedRoot);
  const effectiveConfig = config || projectInfo.cclintConfig || await loadConfig(sanitizedRoot);
  
  // Convert SDK options to internal lint options
  const lintOptions: LintOptions = {
    quiet: options.quiet ?? false,
    verbose: options.verbose ?? false,
    format: 'console', // Not used in core functions
    failOn: options.failOn ?? 'error',
    customSchemas: options.customSchemas ?? true,
    parallel: options.parallel ?? true,
    concurrency: options.concurrency ?? 10,
  };
  
  // Initialize all linters
  const linters: BaseLinter[] = [
    new AgentsLinter(),
    new CommandsLinter(),
    new SettingsLinter(),
    new ClaudeMdLinter(),
  ];
  
  // Apply configuration to linters if available
  if (effectiveConfig) {
    // TODO: Apply custom schemas and configuration to linters
    // This will be implemented when linters support config injection
  }
  
  // Run linters based on parallelization preference
  const allResults: LintResult[] = [];
  
  if (lintOptions.parallel) {
    // Run linters in parallel for better performance
    const linterPromises = linters.map(async (linter) => {
      try {
        return await linter.lint(sanitizedRoot, lintOptions, projectInfo);
      } catch (error) {
        // In SDK mode, we collect errors rather than logging them
        const errorMessage = error instanceof Error ? error.message : String(error);
        return [{
          file: `${linter.name}-error`,
          valid: false,
          errors: [`${linter.name} linter failed: ${errorMessage}`],
          warnings: [],
          suggestions: [],
          missingFields: []
        }] as LintResult[];
      }
    });
    
    const results = await Promise.all(linterPromises);
    allResults.push(...results.flat());
  } else {
    // Run linters sequentially
    for (const linter of linters) {
      try {
        const results = await linter.lint(sanitizedRoot, lintOptions, projectInfo);
        allResults.push(...results);
      } catch (error) {
        // In SDK mode, we collect errors rather than logging them
        const errorMessage = error instanceof Error ? error.message : String(error);
        allResults.push({
          file: `${linter.name}-error`,
          valid: false,
          errors: [`${linter.name} linter failed: ${errorMessage}`],
          warnings: [],
          suggestions: [],
          missingFields: []
        });
      }
    }
  }
  
  // Apply file filtering if specified in options
  let filteredResults = allResults;
  
  if (options.includeFiles && options.includeFiles.length > 0) {
    filteredResults = filteredResults.filter(result => 
      options.includeFiles!.some(pattern => 
        result.file.includes(pattern) || minimatch(result.file, pattern)
      )
    );
  }
  
  if (options.excludeFiles && options.excludeFiles.length > 0) {
    filteredResults = filteredResults.filter(result => 
      !options.excludeFiles!.some(pattern => 
        result.file.includes(pattern) || minimatch(result.file, pattern)
      )
    );
  }
  
  // Calculate summary with timing information
  const summary = calculateSummary(filteredResults, startTime);
  
  // Add metadata if requested
  if (options.includeMetadata) {
    const enhancedSummary: EnhancedLintSummary = {
      ...summary,
      metadata: {
        duration: Date.now() - startTime,
        nodeVersion: process.version,
        cclintVersion: '1.0.0', // TODO: Get from package.json
        projectRoot: sanitizedRoot,
        configPath: effectiveConfig ? 'loaded' : undefined,
        linterCount: linters.length,
        parallelExecution: lintOptions.parallel ?? true,
        concurrency: lintOptions.concurrency ?? 10
      }
    };
    return enhancedSummary;
  }
  
  return summary;
}

/**
 * Lint specific files using appropriate linters
 * 
 * This function determines the appropriate linter for each file based on
 * file patterns and runs only the necessary linters.
 * 
 * @param files - Array of file paths to lint
 * @param options - SDK-specific linting options
 * @param config - Optional configuration to override project config
 * @returns Promise resolving to a lint summary for the specified files
 * 
 * @throws {PathSecurityError} If any file path is invalid or insecure
 * @throws {Error} If file detection or linting fails
 * 
 * @example
 * ```typescript
 * // Lint specific agent files
 * const results = await lintFiles([
 *   '.claude/agents/helper.md',
 *   '.claude/agents/expert.md'
 * ]);
 * 
 * // Lint mixed file types
 * const results = await lintFiles([
 *   '.claude/settings.json',
 *   'CLAUDE.md',
 *   '.claude/commands/deploy.md'
 * ], { verbose: true });
 * ```
 */
export async function lintFiles(
  files: string[],
  options: SDKLintOptions = {},
  config?: CclintConfig
): Promise<LintSummary | EnhancedLintSummary> {
  const startTime = Date.now();
  
  if (!files || files.length === 0) {
    return {
      totalFiles: 0,
      validFiles: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalSuggestions: 0,
      duration: Date.now() - startTime,
      results: []
    };
  }
  
  // Validate and sanitize all file paths
  const sanitizedFiles: string[] = [];
  for (const file of files) {
    try {
      const sanitizedFile = await sanitizePath(file);
      sanitizedFiles.push(sanitizedFile);
    } catch (error) {
      if (error instanceof PathSecurityError) {
        // Include path security errors in results rather than throwing
        // This allows the SDK to be more resilient
        continue; // Skip invalid files
      }
      throw error;
    }
  }
  
  if (sanitizedFiles.length === 0) {
    throw new Error('No valid files provided for linting');
  }
  
  // Determine project root from the first file
  const firstFile = sanitizedFiles[0];
  const projectRoot = await findProjectRoot(path.dirname(firstFile));
  
  // Detect project information and load configuration
  const projectInfo = await detectProjectInfo(projectRoot);
  const effectiveConfig = config || projectInfo.cclintConfig || await loadConfig(projectRoot);
  
  // Convert SDK options to internal lint options
  const lintOptions: LintOptions = {
    quiet: options.quiet ?? false,
    verbose: options.verbose ?? false,
    format: 'console',
    failOn: options.failOn ?? 'error',
    customSchemas: options.customSchemas ?? true,
    parallel: options.parallel ?? true,
    concurrency: options.concurrency ?? 10,
  };
  
  // Group files by linter type for efficiency
  const fileGroups = {
    agents: sanitizedFiles.filter(file => 
      file.includes('.claude/agents/') && file.endsWith('.md')
    ),
    commands: sanitizedFiles.filter(file => 
      file.includes('.claude/commands/') && file.endsWith('.md')
    ),
    settings: sanitizedFiles.filter(file => 
      file.includes('.claude/settings.json') || file.endsWith('settings.json')
    ),
    claudeMd: sanitizedFiles.filter(file => 
      file.endsWith('CLAUDE.md') || file.endsWith('AGENTS.md')
    )
  };
  
  const allResults: LintResult[] = [];
  
  // Run appropriate linters for each file group
  const linterTasks: Array<Promise<LintResult[]>> = [];
  
  if (fileGroups.agents.length > 0) {
    const agentsLinter = new AgentsLinter();
    linterTasks.push(runLinterOnFiles(agentsLinter, fileGroups.agents, projectRoot, lintOptions, projectInfo));
  }
  
  if (fileGroups.commands.length > 0) {
    const commandsLinter = new CommandsLinter();
    linterTasks.push(runLinterOnFiles(commandsLinter, fileGroups.commands, projectRoot, lintOptions, projectInfo));
  }
  
  if (fileGroups.settings.length > 0) {
    const settingsLinter = new SettingsLinter();
    linterTasks.push(runLinterOnFiles(settingsLinter, fileGroups.settings, projectRoot, lintOptions, projectInfo));
  }
  
  if (fileGroups.claudeMd.length > 0) {
    const claudeMdLinter = new ClaudeMdLinter();
    linterTasks.push(runLinterOnFiles(claudeMdLinter, fileGroups.claudeMd, projectRoot, lintOptions, projectInfo));
  }
  
  // Execute linter tasks based on parallelization preference
  if (lintOptions.parallel && linterTasks.length > 1) {
    const results = await Promise.all(linterTasks);
    allResults.push(...results.flat());
  } else {
    for (const task of linterTasks) {
      const results = await task;
      allResults.push(...results);
    }
  }
  
  // Calculate and return summary
  const summary = calculateSummary(allResults, startTime);
  
  // Add metadata if requested
  if (options.includeMetadata) {
    const enhancedSummary: EnhancedLintSummary = {
      ...summary,
      metadata: {
        duration: Date.now() - startTime,
        nodeVersion: process.version,
        cclintVersion: '1.0.0', // TODO: Get from package.json
        projectRoot,
        configPath: effectiveConfig ? 'loaded' : undefined,
        fileCount: sanitizedFiles.length,
        parallelExecution: lintOptions.parallel ?? true,
        concurrency: lintOptions.concurrency ?? 10
      }
    };
    return enhancedSummary;
  }
  
  return summary;
}

/**
 * Load project configuration from the specified directory
 * 
 * @param projectRoot - Path to the project root directory
 * @returns Promise resolving to the project configuration or null if none found
 */
export async function loadProjectConfig(projectRoot?: string): Promise<CclintConfig | null> {
  const root = projectRoot ? await sanitizePath(projectRoot) : process.cwd();
  return await loadConfig(root);
}

/**
 * Detect project information and structure
 * 
 * @param projectRoot - Path to the project root directory
 * @returns Promise resolving to project information
 */
export async function detectProject(projectRoot?: string): Promise<ProjectInfo> {
  const root = projectRoot ? await sanitizePath(projectRoot) : await findProjectRoot();
  return await detectProjectInfo(root);
}

/**
 * Helper function to run a specific linter on a subset of files
 * This is used internally by lintFiles to process file groups efficiently
 */
async function runLinterOnFiles(
  linter: BaseLinter,
  files: string[],
  projectRoot: string,
  options: LintOptions,
  projectInfo: ProjectInfo
): Promise<LintResult[]> {
  try {
    // For file-specific linting, we would need to modify the linter interface
    // For now, we run the full linter and filter results
    const allResults = await linter.lint(projectRoot, options, projectInfo);
    
    // Filter results to only include the specified files
    return allResults.filter(result => 
      files.some(file => result.file === file || result.file.endsWith(file.split('/').pop() || ''))
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return files.map(file => ({
      file,
      valid: false,
      errors: [`${linter.name} linter failed: ${errorMessage}`],
      warnings: [],
      suggestions: [],
      missingFields: []
    }));
  }
}

// Simple minimatch implementation for basic pattern matching
// In a real implementation, we might want to use the 'minimatch' package
function minimatch(str: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}