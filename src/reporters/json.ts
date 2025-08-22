import type { LintSummary } from '../types/index.js';

/**
 * JSON reporter for cclint results
 */
export class JsonReporter {
  report(summary: LintSummary): string {
    return JSON.stringify(summary, null, 2);
  }
}