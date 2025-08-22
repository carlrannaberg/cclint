import { promises as fs } from 'fs';
import * as path from 'path';
import type { LintSummary, LintResult } from '../types/index.js';

/**
 * Utility functions for cclint
 */

export function calculateSummary(results: LintResult[], startTime: number): LintSummary {
  const summary: LintSummary = {
    totalFiles: results.length,
    validFiles: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalSuggestions: 0,
    totalUnusedFields: 0,
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
    summary.totalUnusedFields += result.unusedFields.length;
    
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