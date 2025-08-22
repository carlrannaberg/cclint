import * as path from 'path';
import type { BaseLinter, LintResult, LintOptions, ProjectInfo, CclintConfig, FrontmatterData } from '../types/index.js';

/**
 * @fileoverview Base linter implementation providing common functionality for all linters.
 * 
 * This module defines the abstract base class that all specific linters extend,
 * providing shared utilities for file processing, validation, and reporting.
 * 
 * @author CClint Team
 * @version 1.0.0
 */

/**
 * Abstract base class for all cclint linters.
 * 
 * Provides common functionality including:
 * - Result creation and manipulation methods
 * - Frontmatter processing utilities
 * - File discovery with pattern matching
 * - Parallel processing support
 * - Custom validation execution
 * - Zod schema validation helpers
 * 
 * @abstract
 * @implements {BaseLinter}
 */
export abstract class BaseLinterImpl implements BaseLinter {
  abstract name: string;
  abstract description: string;
  
  abstract lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]>;

  /**
   * Create a new lint result object for a file.
   * 
   * @param {string} file - Absolute path to the file being linted
   * @returns {LintResult} New lint result initialized with empty arrays
   */
  protected createResult(file: string): LintResult {
    return {
      file,
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      unusedFields: [],
      missingFields: [],
    };
  }

  protected markInvalid(result: LintResult): void {
    result.valid = false;
  }

  protected addError(result: LintResult, message: string): void {
    result.errors.push(message);
    this.markInvalid(result);
  }

  protected addWarning(result: LintResult, message: string): void {
    result.warnings.push(message);
  }

  protected addSuggestion(result: LintResult, message: string): void {
    result.suggestions.push(message);
  }

  protected addUnusedField(result: LintResult, field: string): void {
    if (!result.unusedFields.includes(field)) {
      result.unusedFields.push(field);
    }
  }

  protected addMissingField(result: LintResult, field: string): void {
    if (!result.missingFields.includes(field)) {
      result.missingFields.push(field);
    }
  }

  /**
   * Common pattern for running custom validation functions
   * Extracts duplicate validation logic from individual linters
   */
  protected runCustomValidation<T = Record<string, unknown>>(
    data: T,
    result: LintResult,
    customValidation: ((data: T) => string[]) | undefined
  ): void {
    if (!customValidation) {
      return;
    }

    try {
      const customErrors = customValidation(data);
      for (const error of customErrors) {
        if (!result.customSchemaErrors) {
          result.customSchemaErrors = [];
        }
        result.customSchemaErrors.push(error);
        this.addError(result, `Custom validation: ${error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addError(result, `Custom validation failed: ${errorMessage}`);
      if (process.env.CCLINT_VERBOSE) {
        console.error(`Custom validation error in ${this.name}:`, error);
      }
    }
  }

  /**
   * Common pattern for processing frontmatter-based files
   * Extracts duplicate file processing logic from individual linters
   */
  protected async processFrontmatterFile<T>(
    filePath: string,
    content: string,
    schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: ZodIssue[] } } },
    config?: CclintConfig
  ): Promise<{ result: LintResult; frontmatter?: T; markdown?: string }> {
    const result = this.createResult(filePath);

    // Skip files without frontmatter
    if (!hasFrontmatter(content)) {
      return { result };
    }

    // Parse frontmatter
    let frontmatter: Record<string, unknown>;
    let markdown: string;

    try {
      const matter = await import('gray-matter');
      const parsed = matter.default(content);
      frontmatter = parsed.data;
      markdown = parsed.content;
    } catch (error) {
      this.addError(result, `Failed to parse frontmatter: ${error}`);
      return { result };
    }

    // Schema validation
    const validation = schema.safeParse(frontmatter);
    if (!validation.success && validation.error) {
      this.markInvalid(result);

      for (const issue of validation.error.issues) {
        handleZodValidationIssue(
          issue,
          result,
          this.addError.bind(this),
          this.addWarning.bind(this),
          this.addMissingField.bind(this),
          this.addUnusedField.bind(this)
        );
      }
    }

    return { result, frontmatter: frontmatter as T, markdown };
  }

  /**
   * Common pattern for finding markdown files in multiple directories
   * Extracts duplicate file discovery logic from individual linters  
   */
  protected async findMarkdownFilesInDirectories(
    projectRoot: string,
    directories: string[],
    config?: CclintConfig
  ): Promise<string[]> {
    const allFiles: string[] = [];
    const searchDirs = [...directories];

    // Add custom include patterns if specified
    if (config?.rules?.includePatterns) {
      for (const pattern of config.rules.includePatterns) {
        searchDirs.push(path.join(projectRoot, pattern));
      }
    }

    for (const dir of searchDirs) {
      try {
        const glob = await import('glob');
        const pattern = path.join(dir, '**/*.md');
        const files = await glob.glob(pattern);
        
        for (const file of files) {
          // Skip excluded patterns
          if (!shouldSkipFile(file, config?.rules?.excludePatterns)) {
            allFiles.push(file);
          }
        }
      } catch {
        // Directory doesn't exist or isn't accessible
      }
    }

    return allFiles;
  }

  /**
   * Common pattern for linting multiple files with a processor function
   * Supports both sequential and parallel processing modes
   * Reduces code duplication in lint method implementations
   */
  protected async lintFiles<T>(
    files: string[],
    processor: (file: string, config?: CclintConfig) => Promise<LintResult | null>,
    config?: CclintConfig,
    options: { parallel?: boolean; concurrency?: number } = {}
  ): Promise<LintResult[]> {
    const { parallel = true, concurrency = 10 } = options;
    
    if (!parallel || files.length <= 1) {
      // Sequential processing for small batches or when explicitly disabled
      const results: LintResult[] = [];
      for (const file of files) {
        const result = await processor(file, config);
        if (result) {
          results.push(result);
        }
      }
      return results;
    }

    // Parallel processing with concurrency control
    return this.processFilesInParallel(files, processor, config, concurrency);
  }

  /**
   * Process files in parallel with concurrency control to avoid overwhelming the system
   */
  private async processFilesInParallel<T>(
    files: string[],
    processor: (file: string, config?: CclintConfig) => Promise<LintResult | null>,
    config?: CclintConfig,
    concurrency: number = 10
  ): Promise<LintResult[]> {
    const results: LintResult[] = [];
    const processing: Promise<void>[] = [];
    let index = 0;

    const processNext = async (): Promise<void> => {
      while (index < files.length) {
        const fileIndex = index++;
        const file = files[fileIndex];
        
        try {
          const result = await processor(file, config);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          // Create an error result for the failed file
          const errorResult = this.createResult(file);
          this.addError(errorResult, `Processing failed: ${error instanceof Error ? error.message : String(error)}`);
          results.push(errorResult);
        }
      }
    };

    // Start concurrent workers
    for (let i = 0; i < Math.min(concurrency, files.length); i++) {
      processing.push(processNext());
    }

    // Wait for all workers to complete
    await Promise.all(processing);

    // Sort results by file path to ensure consistent output order
    return results.sort((a, b) => a.file.localeCompare(b.file));
  }
}

/**
 * Check if a file has frontmatter (starts with ---)
 */
export function hasFrontmatter(content: string): boolean {
  const lines = content.split('\n');
  return lines.length > 0 && lines[0] === '---';
}

/**
 * Validate tool patterns (like "Bash(git:*)")
 */
export function validateToolPattern(tool: string): string[] {
  const warnings: string[] = [];
  
  // Check for proper parenthesis matching
  const openParens = (tool.match(/\(/g) || []).length;
  const closeParens = (tool.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    warnings.push(`Unmatched parentheses in tool specification: ${tool}`);
  }

  return warnings;
}

/**
 * Check if color is valid (hex or CSS named color)
 */
export function validateColor(color: string, cssColors: Set<string>): boolean {
  // Check hex color format
  const hexColorRegex = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;
  if (color.startsWith('#')) {
    return hexColorRegex.test(color);
  }
  
  // Check CSS named color
  return cssColors.has(color.toLowerCase());
}

/**
 * Check if a file should be skipped based on exclude patterns
 */
export function shouldSkipFile(filePath: string, excludePatterns?: string[]): boolean {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false;
  }
  
  const relativePath = path.relative(process.cwd(), filePath);
  
  return excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(relativePath);
  });
}

/**
 * Zod issue interface for unrecognized keys
 */
interface ZodUnrecognizedKeysIssue {
  code: 'unrecognized_keys';
  keys: string[];
  path: (string | number)[];
  message: string;
}

/**
 * Zod issue interface for invalid type
 */
interface ZodInvalidTypeIssue {
  code: 'invalid_type';
  received: string;
  expected: string;
  path: (string | number)[];
  message: string;
}

/**
 * Generic Zod issue interface
 */
interface ZodIssue {
  code: string;
  path: (string | number)[];
  message: string;
}

/**
 * Handle Zod validation issues with standardized error processing
 */
export function handleZodValidationIssue(
  issue: ZodIssue | ZodUnrecognizedKeysIssue | ZodInvalidTypeIssue, 
  result: LintResult, 
  addError: (result: LintResult, message: string) => void,
  addWarning: (result: LintResult, message: string) => void,
  addMissingField: (result: LintResult, field: string) => void,
  addUnusedField: (result: LintResult, field: string) => void
): void {
  const field = issue.path.join('.');
  
  if (issue.code === 'invalid_type') {
    const invalidTypeIssue = issue as ZodInvalidTypeIssue;
    if (invalidTypeIssue.received === 'undefined') {
      addMissingField(result, field);
      addError(result, `Missing required field: ${field}`);
    } else {
      addError(result, `${field}: ${issue.message}`);
    }
  } else if (issue.code === 'unrecognized_keys') {
    // Handle unrecognized fields
    const unrecognizedIssue = issue as ZodUnrecognizedKeysIssue;
    if (unrecognizedIssue.keys) {
      for (const key of unrecognizedIssue.keys) {
        addUnusedField(result, key);
        addWarning(result, `Unrecognized field: ${key}`);
      }
    }
  } else {
    addError(result, `${field}: ${issue.message}`);
  }
}