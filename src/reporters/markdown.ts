import type { LintSummary, LintResult } from '../types/index.js';

/**
 * Markdown reporter for cclint results
 */
export class MarkdownReporter {
  report(summary: LintSummary): string {
    const sections: string[] = [];

    // Header
    sections.push('# Claude Code Lint Report\n');
    sections.push(`Generated on: ${new Date().toISOString()}\n`);

    // Summary
    sections.push(this.generateSummary(summary));

    // Detailed results
    if (summary.results.length > 0) {
      sections.push('## Detailed Results\n');
      
      for (const result of summary.results) {
        sections.push(this.generateFileReport(result));
      }
    }

    // Recommendations
    sections.push(this.generateRecommendations(summary));

    return sections.join('\n');
  }

  private generateSummary(summary: LintSummary): string {
    const lines: string[] = [
      '## Summary\n',
      '| Metric | Count |',
      '|--------|-------|',
      `| Files checked | ${summary.totalFiles} |`,
      `| Valid files | ${summary.validFiles} |`,
      `| Errors | ${summary.totalErrors} |`,
      `| Warnings | ${summary.totalWarnings} |`,
      `| Suggestions | ${summary.totalSuggestions} |`,
      `| Duration | ${summary.duration}ms |`,
      '',
    ];

    // Status badge
    if (summary.totalErrors > 0) {
      lines.push('**Status:** ❌ Failed with errors\n');
    } else if (summary.totalWarnings > 0) {
      lines.push('**Status:** ⚠️ Completed with warnings\n');
    } else {
      lines.push('**Status:** ✅ All checks passed\n');
    }

    return lines.join('\n');
  }

  private generateFileReport(result: LintResult): string {
    const sections: string[] = [];
    
    // Skip files with no issues
    if (this.hasNoIssues(result)) {
      return '';
    }

    // File header
    const relativePath = this.getRelativePath(result.file);
    sections.push(`### \`${relativePath}\`\n`);

    // Errors
    if (result.errors.length > 0) {
      sections.push('**Errors:**\n');
      for (const error of result.errors) {
        sections.push(`- ❌ ${error}`);
      }
      sections.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      sections.push('**Warnings:**\n');
      for (const warning of result.warnings) {
        sections.push(`- ⚠️ ${warning}`);
      }
      sections.push('');
    }


    // Suggestions
    if (result.suggestions.length > 0) {
      sections.push('**Suggestions:**\n');
      for (const suggestion of result.suggestions) {
        sections.push(`- 💡 ${suggestion}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private generateRecommendations(summary: LintSummary): string {
    const sections: string[] = ['## Recommendations\n'];

    if (summary.totalErrors > 0) {
      sections.push('### Priority: High (Errors)\n');
      sections.push('Fix all errors before proceeding. Errors indicate invalid configurations that may cause issues.\n');
    }

    if (summary.totalWarnings > 0) {
      sections.push('### Priority: Medium (Warnings)\n');
      sections.push('Address warnings to improve configuration quality and avoid potential issues.\n');
    }


    if (summary.totalSuggestions > 0) {
      sections.push('### Priority: Optional (Improvements)\n');
      sections.push('Consider implementing suggestions to enhance your Claude Code setup.\n');
    }

    // General recommendations
    sections.push('### General Tips\n');
    sections.push('- Keep configurations minimal and focused');
    sections.push('- Document custom patterns and conventions');
    sections.push('- Test configurations thoroughly');
    sections.push('- Follow the AGENTS.md template for documentation');

    return sections.join('\n');
  }

  private hasNoIssues(result: LintResult): boolean {
    return (
      result.errors.length === 0 &&
      result.warnings.length === 0 &&
      result.suggestions.length === 0
    );
  }

  private getRelativePath(filePath: string): string {
    const cwd = process.cwd();
    if (filePath.startsWith(cwd)) {
      return filePath.substring(cwd.length + 1);
    }
    return filePath;
  }
}