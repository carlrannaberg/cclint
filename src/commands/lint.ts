import ora from 'ora';
import { ConsoleReporter } from '../reporters/console.js';
import { JsonReporter } from '../reporters/json.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { lintProject } from '../lib/core.js';
import { writeReportToFile, getExitCode, sanitizePath, PathSecurityError } from '../lib/utils.js';
import type { LintOptions, LintSummary, SDKLintOptions } from '../types/index.js';

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
  let spinner: ReturnType<typeof ora> | null = null;

  try {
    // Determine project root
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
      // Use current working directory - core functions will handle project detection
      projectRoot = process.cwd();
    }
    
    if (!options.quiet) {
      console.log(`Linting Claude Code project at: ${projectRoot}`);
      spinner = ora('Running linters...').start();
    }

    // Convert CLI options to SDK options
    const sdkOptions: SDKLintOptions = {
      quiet: options.quiet,
      verbose: options.verbose,
      failOn: options.failOn,
      customSchemas: options.customSchemas,
      parallel: options.parallel,
      concurrency: options.concurrency,
      includeMetadata: false // CLI doesn't need internal metadata
    };

    // Use the core linting function
    const summary = await lintProject(projectRoot, sdkOptions);

    if (spinner) {
      spinner.succeed('Linting completed');
    }

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
  // Stdout output based on format
  switch (options.format) {
    case 'json':
      const jsonReporter = new JsonReporter();
      const jsonContent = jsonReporter.report(summary);
      console.log(jsonContent);
      
      // File output (if requested)
      if (options.outputFile) {
        await writeReportToFile(jsonContent, options.outputFile);
        if (!options.quiet) {
          console.error(`📄 Report saved to: ${options.outputFile}`);
        }
      }
      break;
    
    case 'markdown':
      const markdownReporter = new MarkdownReporter();
      const markdownContent = markdownReporter.report(summary);
      console.log(markdownContent);
      
      // File output (if requested)
      if (options.outputFile) {
        await writeReportToFile(markdownContent, options.outputFile);
        if (!options.quiet) {
          console.error(`📄 Report saved to: ${options.outputFile}`);
        }
      }
      break;
    
    case 'console':
    default:
      const consoleReporter = new ConsoleReporter(options);
      consoleReporter.report(summary);
      
      // File output not supported for console format - it prints directly
      if (options.outputFile) {
        console.error('Warning: File output not supported with console format. Use --format json or markdown.');
      }
      break;
  }
}