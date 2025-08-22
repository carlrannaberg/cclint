import ora from 'ora';
import { AgentsLinter } from '../linters/agents.js';
import { CommandsLinter } from '../linters/commands.js';
import { SettingsLinter } from '../linters/settings.js';
import { ClaudeMdLinter } from '../linters/claude-md.js';
import { ConsoleReporter } from '../reporters/console.js';
import { JsonReporter } from '../reporters/json.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { findProjectRoot, detectProjectInfo } from '../lib/project-detection.js';
import { calculateSummary, writeReportToFile, getExitCode, sanitizePath, PathSecurityError } from '../lib/utils.js';
import type { LintOptions, LintResult, BaseLinter, LintSummary } from '../types/index.js';

/**
 * Main lint command implementation - coordinates all linters and generates reports.
 * 
 * This function:
 * 1. Validates and sanitizes the project root path for security
 * 2. Detects project information and configuration
 * 3. Runs all applicable linters (agents, commands, settings, CLAUDE.md)
 * 4. Collects and consolidates results
 * 5. Generates reports in the specified format
 * 6. Handles output to file if requested
 * 7. Sets appropriate exit code based on results
 * 
 * @param {LintOptions} options - Comprehensive linting options
 * @param {string} [options.root] - Project root directory (auto-detected if not provided)
 * @param {boolean} [options.quiet=false] - Suppress non-essential output
 * @param {boolean} [options.verbose=false] - Enable verbose output with detailed information
 * @param {'console'|'json'|'markdown'} [options.format='console'] - Output format for reports
 * @param {string} [options.outputFile] - File path to write report (requires --format)
 * @param {'error'|'warning'|'suggestion'} [options.failOn='error'] - Minimum severity level to fail build
 * @param {boolean} [options.customSchemas=true] - Enable custom schema validation from config
 * @param {boolean} [options.parallel=true] - Enable parallel file processing for better performance
 * @param {number} [options.concurrency=10] - Maximum concurrent file processing operations
 * 
 * @throws {Error} If project root is invalid, inaccessible, or contains security risks
 * @throws {Error} If output file path is invalid or unwritable
 * 
 * @example
 * ```typescript
 * // Basic usage with auto-detection
 * await lintCommand({});
 * 
 * // Custom project root with JSON output
 * await lintCommand({
 *   root: '/path/to/project',
 *   format: 'json',
 *   outputFile: 'lint-results.json'
 * });
 * 
 * // High-performance mode with custom concurrency
 * await lintCommand({
 *   parallel: true,
 *   concurrency: 20,
 *   quiet: true
 * });
 * ```
 */
export async function lintCommand(options: LintOptions): Promise<void> {
  const startTime = Date.now();
  let spinner: ReturnType<typeof ora> | null = null;

  try {
    // Find and sanitize project root
    let projectRoot: string;
    
    if (options.root) {
      try {
        // Sanitize user-provided path to prevent path traversal attacks
        projectRoot = await sanitizePath(options.root);
      } catch (error) {
        if (error instanceof PathSecurityError) {
          console.error(`Security Error: ${error.message}`);
          process.exit(1);
        }
        throw error;
      }
    } else {
      // Auto-detect project root (already safe since it starts from cwd)
      projectRoot = await findProjectRoot();
    }
    
    if (!options.quiet) {
      console.log(`Linting Claude Code project at: ${projectRoot}`);
      spinner = ora('Detecting project structure...').start();
    }

    // Detect project info
    const projectInfo = await detectProjectInfo(projectRoot);
    
    if (spinner) {
      spinner.text = 'Running linters...';
    }

    // Initialize linters
    const linters: BaseLinter[] = [
      new AgentsLinter(),
      new CommandsLinter(), 
      new SettingsLinter(),
      new ClaudeMdLinter(),
    ];

    // Run all linters
    const allResults: LintResult[] = [];
    
    for (const linter of linters) {
      if (spinner) {
        spinner.text = `Running ${linter.name} linter...`;
      }
      
      try {
        const results = await linter.lint(projectRoot, options, projectInfo);
        allResults.push(...results);
      } catch (error) {
        console.error(`Error running ${linter.name} linter:`, error);
      }
    }

    if (spinner) {
      spinner.succeed('Linting completed');
    }

    // Calculate summary
    const summary = calculateSummary(allResults, startTime);

    // Generate reports
    await generateReports(summary, options);

    // Exit with appropriate code
    const exitCode = getExitCode(summary, options.failOn || 'error');
    process.exit(exitCode);

  } catch (error) {
    if (spinner) {
      spinner.fail('Linting failed');
    }
    console.error('Error during linting:', error);
    process.exit(1);
  }
}

async function generateReports(summary: LintSummary, options: LintOptions): Promise<void> {
  // Console output (always)
  const consoleReporter = new ConsoleReporter(options);
  consoleReporter.report(summary);

  // File output (if requested)
  if (options.outputFile) {
    let content: string;
    
    switch (options.format) {
      case 'json':
        const jsonReporter = new JsonReporter();
        content = jsonReporter.report(summary);
        break;
      
      case 'markdown':
        const markdownReporter = new MarkdownReporter();
        content = markdownReporter.report(summary);
        break;
      
      default:
        throw new Error(`Unsupported output format: ${options.format}`);
    }

    await writeReportToFile(content, options.outputFile);
    
    if (!options.quiet) {
      console.log(`\n📄 Report saved to: ${options.outputFile}`);
    }
  }
}