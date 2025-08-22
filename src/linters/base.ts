import type { BaseLinter, LintResult, LintOptions, ProjectInfo } from '../types/index.js';

/**
 * Base linter interface and utilities
 */

export abstract class BaseLinterImpl implements BaseLinter {
  abstract name: string;
  abstract description: string;
  
  abstract lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]>;

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
  
  const path = require('path');
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