import { promises as fs } from 'fs';
import * as path from 'path';
import type { LintSummary, LintResult } from '../types/index.js';

/**
 * Utility functions for cclint
 */

/**
 * Security error class for path validation issues
 */
export class PathSecurityError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Sanitizes and validates a file system path to prevent path traversal attacks
 * @param inputPath - The path to sanitize
 * @param allowedBasePath - Optional base path to restrict access to (defaults to cwd)
 * @returns Sanitized absolute path
 * @throws PathSecurityError if the path is invalid or insecure
 */
export async function sanitizePath(inputPath: string, allowedBasePath: string = process.cwd()): Promise<string> {

  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathSecurityError('Path must be a non-empty string', inputPath || '');
  }

  // Trim whitespace and remove null bytes
  const cleanPath = inputPath.trim().replace(/\0/g, '');
  
  if (cleanPath === '') {
    throw new PathSecurityError('Path cannot be empty or whitespace only', inputPath);
  }

  // Resolve base path to absolute path first
  const resolvedBasePath = path.resolve(allowedBasePath);
  
  // If input path is relative, resolve it relative to the base path
  // Otherwise resolve it normally
  const resolvedPath = path.isAbsolute(cleanPath) ? 
    path.resolve(cleanPath) : 
    path.resolve(resolvedBasePath, cleanPath);
  
  // Check if the resolved path is within the allowed base path
  const relativePath = path.relative(resolvedBasePath, resolvedPath);
  
  // If relative path starts with '..' or is absolute, it's outside the allowed base
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new PathSecurityError(
      `Path traversal attempt detected. Path '${inputPath}' resolves outside allowed directory '${allowedBasePath}'`,
      inputPath
    );
  }

  // Check if the path exists
  try {
    const stat = await fs.stat(resolvedPath);
    
    // Ensure it's a directory for our use case
    if (!stat.isDirectory()) {
      throw new PathSecurityError(`Path must be a directory: ${resolvedPath}`, inputPath);
    }

    // Check for symbolic links that might escape the allowed directory
    const realPath = await fs.realpath(resolvedPath);
    const realBasePath = await fs.realpath(resolvedBasePath);
    const relativeRealPath = path.relative(realBasePath, realPath);
    
    if (relativeRealPath.startsWith('..') || path.isAbsolute(relativeRealPath)) {
      throw new PathSecurityError(
        `Symbolic link traversal detected. Path '${inputPath}' links outside allowed directory`,
        inputPath
      );
    }
    
    return realPath;
  } catch (error) {
    if (error instanceof PathSecurityError) {
      throw error;
    }
    
    // Handle file system errors
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new PathSecurityError(`Path does not exist: ${resolvedPath}`, inputPath);
    } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new PathSecurityError(`Permission denied accessing path: ${resolvedPath}`, inputPath);
    } else {
      throw new PathSecurityError(
        `Failed to access path: ${resolvedPath} (${(error as Error).message})`,
        inputPath
      );
    }
  }
}

/**
 * Validates if a path is safe to use (synchronous version for quick checks)
 * @param inputPath - The path to validate
 * @param allowedBasePath - Optional base path to restrict access to
 * @returns boolean indicating if path appears safe
 */
export function isPathSafe(inputPath: string, allowedBasePath: string = process.cwd()): boolean {
  try {
    if (!inputPath || typeof inputPath !== 'string') {
      return false;
    }

    // Check for null bytes before cleaning (security concern)
    if (inputPath.includes('\0')) {
      return false;
    }

    const cleanPath = inputPath.trim();
    if (cleanPath === '') {
      return false;
    }

    // Resolve base path to absolute path first
    const resolvedBasePath = path.resolve(allowedBasePath);
    
    // If input path is relative, resolve it relative to the base path
    // Otherwise resolve it normally
    const resolvedPath = path.isAbsolute(cleanPath) ? 
      path.resolve(cleanPath) : 
      path.resolve(resolvedBasePath, cleanPath);
    
    const relativePath = path.relative(resolvedBasePath, resolvedPath);
    
    // Check for path traversal
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  } catch {
    return false;
  }
}

export function calculateSummary(results: LintResult[], startTime: number): LintSummary {
  const summary: LintSummary = {
    totalFiles: results.length,
    validFiles: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalSuggestions: 0,
    duration: Date.now() - startTime,
    results,
  };

  for (const result of results) {
    if (result.valid) {
      summary.validFiles++;
    }
    summary.totalErrors += result.errors.length;
    summary.totalWarnings += result.warnings.length;
    summary.totalSuggestions += result.suggestions.length;
    
    // Include custom schema errors in error count
    if (result.customSchemaErrors) {
      summary.totalErrors += result.customSchemaErrors.length;
    }
  }

  return summary;
}

export async function writeReportToFile(content: string, outputPath: string): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  
  // Write file
  await fs.writeFile(outputPath, content, 'utf-8');
}

export function shouldFailBuild(summary: LintSummary, failOn: string): boolean {
  switch (failOn) {
    case 'error':
      return summary.totalErrors > 0;
    case 'warning':
      return summary.totalErrors > 0 || summary.totalWarnings > 0;
    case 'suggestion':
      return summary.totalErrors > 0 || summary.totalWarnings > 0 || summary.totalSuggestions > 0;
    default:
      return summary.totalErrors > 0; // Default to error level
  }
}

export function getExitCode(summary: LintSummary, failOn: string): number {
  if (shouldFailBuild(summary, failOn)) {
    return 1; // Failure
  }
  return 0; // Success
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || singular + 's'}`;
}