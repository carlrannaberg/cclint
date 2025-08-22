import chalk from 'chalk';
import type { LintSummary, LintResult, LintOptions } from '../types/index.js';

/**
 * Console reporter for cclint results
 */
export class ConsoleReporter {
  constructor(private options: LintOptions) {}

  report(summary: LintSummary): void {
    this.printHeader();
    this.printResults(summary.results);
    this.printSummary(summary);
  }

  private printHeader(): void {
    if (!this.options.quiet) {
      console.log(chalk.bold.blue('\n🔍 Claude Code Lint Report\n'));
    }
  }

  private printResults(results: LintResult[]): void {
    for (const result of results) {
      this.printFileResult(result);
    }
  }

  private printFileResult(result: LintResult): void {
    // Skip valid files with no issues unless verbose mode
    if (this.shouldSkipFile(result)) {
      return;
    }

    // Print file header
    const relativePath = this.getRelativePath(result.file);
    console.log(chalk.bold(`\n${relativePath}:`));

    // Print validation status for verbose mode
    if (this.options.verbose && result.valid && this.hasNoIssues(result)) {
      console.log(chalk.green('  ✓ Valid'));
      return;
    }

    // Print errors
    for (const error of result.errors) {
      console.log(chalk.red(`  ✗ ${error}`));
    }

    // Print warnings
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }

    // Print custom schema errors
    if (result.customSchemaErrors && result.customSchemaErrors.length > 0) {
      for (const customError of result.customSchemaErrors) {
        console.log(chalk.red(`  ✗ Custom Schema: ${customError}`));
      }
    }

    // Print unused fields
    if (result.unusedFields.length > 0) {
      console.log(chalk.yellow(`  ⚠ Unused fields: ${result.unusedFields.join(', ')}`));
    }

    // Print suggestions (unless quiet mode)
    if (!this.options.quiet) {
      for (const suggestion of result.suggestions) {
        console.log(chalk.gray(`  💡 ${suggestion}`));
      }
    }
  }

  private printSummary(summary: LintSummary): void {
    console.log(chalk.bold('\n📊 Summary:\n'));
    
    console.log(`  Files checked: ${summary.totalFiles}`);
    console.log(`  Valid files: ${chalk.green(summary.validFiles.toString())}`);
    console.log(`  Errors: ${this.colorizeCount(summary.totalErrors, 'error')}`);
    console.log(`  Warnings: ${this.colorizeCount(summary.totalWarnings, 'warning')}`);
    console.log(`  Suggestions: ${this.colorizeCount(summary.totalSuggestions, 'suggestion')}`);
    console.log(`  Unused fields: ${this.colorizeCount(summary.totalUnusedFields, 'warning')}`);
    console.log(`  Duration: ${summary.duration}ms`);

    // Print final status
    this.printFinalStatus(summary);
  }

  private printFinalStatus(summary: LintSummary): void {
    const hasErrors = summary.totalErrors > 0;
    const hasWarnings = summary.totalWarnings > 0;
    const hasSuggestions = summary.totalSuggestions > 0;

    if (hasErrors || hasWarnings) {
      if (hasErrors) {
        console.log(chalk.red('\n❌ Linting failed with errors'));
      } else {
        console.log(chalk.yellow('\n⚠️ Linting completed with warnings'));
      }
      console.log(chalk.cyan('💡 Review the issues above and fix them'));
    } else if (hasSuggestions && !this.options.quiet) {
      console.log(chalk.cyan('\n✨ All files are valid! (with suggestions for improvements)'));
    } else {
      console.log(chalk.green('\n✨ All files are valid!'));
    }
  }

  private shouldSkipFile(result: LintResult): boolean {
    return (
      result.valid &&
      this.hasNoIssues(result) &&
      !this.options.verbose
    );
  }

  private hasNoIssues(result: LintResult): boolean {
    return (
      result.errors.length === 0 &&
      result.warnings.length === 0 &&
      result.unusedFields.length === 0 &&
      result.suggestions.length === 0 &&
      (!result.customSchemaErrors || result.customSchemaErrors.length === 0)
    );
  }

  private colorizeCount(count: number, type: 'error' | 'warning' | 'suggestion'): string {
    if (count === 0) {
      return chalk.green('0');
    }

    switch (type) {
      case 'error':
        return chalk.red(count.toString());
      case 'warning':
        return chalk.yellow(count.toString());
      case 'suggestion':
        return chalk.cyan(count.toString());
      default:
        return count.toString();
    }
  }

  private getRelativePath(filePath: string): string {
    // Try to make path relative to current working directory
    const cwd = process.cwd();
    if (filePath.startsWith(cwd)) {
      return filePath.substring(cwd.length + 1);
    }
    return filePath;
  }
}