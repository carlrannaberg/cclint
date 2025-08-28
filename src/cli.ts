#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { lintCommand } from './commands/lint.js';
import { isPathSafe, calculateSummary, getExitCode } from './lib/utils.js';
import { CClint } from './lib/sdk.js';
import { ConsoleReporter } from './reporters/console.js';
import ora from 'ora';

/**
 * @fileoverview Main CLI entry point for cclint - a comprehensive linting tool for Claude Code projects.
 * 
 * This module provides the command-line interface for linting Claude Code project files,
 * including agents, commands, settings, and documentation validation.
 * 
 * @author CClint Team
 * @version 1.0.0
 */

/**
 * CLI options interface for specialized commands
 */
interface SpecializedCliOptions {
  readonly root?: string;
  readonly quiet?: boolean;
  readonly verbose?: boolean;
  readonly followSymlinks?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads and parses package.json to get version information
 * @returns {Promise<{name: string, version: string}>} Package name and version
 * @throws {Error} If package.json cannot be read or parsed
 */
async function getPackageInfo() {
  try {
    const packagePath = join(__dirname, '../package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(packageContent);
  } catch {
    return { name: 'cclint', version: '1.0.0', description: 'Claude Code Lint' };
  }
}

export async function main(): Promise<void> {
  const pkg = await getPackageInfo();
  
  const program = new Command()
    .name(pkg.name)
    .version(pkg.version)
    .description(pkg.description || 'Claude Code Lint - A comprehensive linting tool for Claude Code projects');

  // Default action - lint everything
  program
    .option('-r, --root <path>', 'Project root directory (auto-detected if not specified)')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-f, --format <format>', 'Output format for reports', 'console')
    .option('-o, --output <file>', 'Output file for reports (requires --format)')
    .option('--fail-on <level>', 'Fail build on specified level', 'error')
    .option('--custom-schemas', 'Enable custom schema validation (default: true)')
    .option('--no-parallel', 'Disable parallel file processing (process files sequentially)')
    .option('--concurrency <number>', 'Maximum number of files to process concurrently (default: 10)', '10')
    .option('--follow-symlinks', 'Follow symlinks when discovering files (security: validates targets remain within project root)')
    .action(async (options) => {
      // Early validation for root path to provide better error messages
      if (options.root && !isPathSafe(options.root)) {
        console.error(`Error: Invalid or potentially unsafe root path: '${options.root}'`);
        console.error('Please provide a valid directory path within the current working directory tree.');
        process.exit(1);
      }

      await lintCommand({
        root: options.root,
        quiet: options.quiet,
        verbose: options.verbose,
        format: options.format as 'console' | 'json' | 'markdown',
        outputFile: options.output,
        failOn: options.failOn as 'error' | 'warning' | 'suggestion',
        customSchemas: options.customSchemas !== false,
        parallel: !options.noParallel,
        concurrency: parseInt(options.concurrency, 10),
        followSymlinks: options.followSymlinks === true,
      });
    });

  // Factory function to create specialized linting commands with professional output
  function createSpecializedCommand(
    name: string,
    description: string,
    linterMethod: 'lintAgents' | 'lintCommands' | 'lintSettings' | 'lintClaudeMd'
  ) {
    return program
      .command(name)
      .description(description)
      .option('-r, --root <path>', 'Project root directory (auto-detected if not specified)')
      .option('-q, --quiet', 'Suppress non-essential output')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--follow-symlinks', 'Follow symlinks when discovering files (security: validates targets remain within project root)')
      .action(async (options: SpecializedCliOptions) => {
        let spinner: ReturnType<typeof ora> | null = null;

        try {
          if (options.root && !isPathSafe(options.root)) {
            console.error(`Error: Invalid or potentially unsafe root path: '${options.root}'`);
            console.error('Please provide a valid directory path within the current working directory tree.');
            process.exit(1);
          }

          // Show progress with spinner (same as main command)
          if (!options.quiet) {
            spinner = ora(`Running ${name} linter...`).start();
          }

          const startTime = Date.now();
          const sdk = new CClint();
          const results = await sdk[linterMethod](options.root, {
            quiet: options.quiet,
            verbose: options.verbose,
            followSymlinks: options.followSymlinks === true,
          });

          if (spinner) {
            spinner.succeed(`${name.charAt(0).toUpperCase() + name.slice(1)} linting completed`);
          }

          // Create LintSummary for consistent reporting
          const summary = calculateSummary(results, startTime);

          // Use the same ConsoleReporter as main command for consistent output
          const consoleReporter = new ConsoleReporter({
            quiet: options.quiet || false,
            verbose: options.verbose || false,
            format: 'console' as const,
            failOn: 'error' as const,
            customSchemas: true,
            parallel: true,
            concurrency: 10,
            followSymlinks: options.followSymlinks || false,
          });

          consoleReporter.report(summary);

          // Exit with appropriate code (same logic as main command)
          const exitCode = getExitCode(summary, 'error');
          process.exit(exitCode);

        } catch (error) {
          if (spinner) {
            spinner.fail(`${name.charAt(0).toUpperCase() + name.slice(1)} linting failed`);
          }
          console.error(`Error during ${name} linting:`, error);
          process.exit(1);
        }
      });
  }

  // Create specialized commands using factory function
  createSpecializedCommand('agents', 'Lint only agent definition files', 'lintAgents');
  createSpecializedCommand('commands', 'Lint only command definition files', 'lintCommands');
  createSpecializedCommand('settings', 'Lint only settings.json files', 'lintSettings');
  createSpecializedCommand('context', 'Lint only CLAUDE.md context files', 'lintClaudeMd');

  await program.parseAsync(process.argv);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}