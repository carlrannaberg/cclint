#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { lintCommand } from './commands/lint.js';
import { isPathSafe } from './lib/utils.js';

/**
 * @fileoverview Main CLI entry point for cclint - a comprehensive linting tool for Claude Code projects.
 * 
 * This module provides the command-line interface for linting Claude Code project files,
 * including agents, commands, settings, and documentation validation.
 * 
 * @author CClint Team
 * @version 1.0.0
 */

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

  // Main lint command
  program
    .command('lint', { isDefault: true })
    .description('Lint Claude Code project files')
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

  // Init command for future extension
  program
    .command('init')
    .description('Initialize cclint configuration')
    .action(() => {
      console.log('Initialize command not yet implemented');
      console.log('cclint works without configuration by auto-detecting project structure');
    });

  // Version command
  program
    .command('version')
    .description('Show version information')
    .action(() => {
      console.log(`${pkg.name} v${pkg.version}`);
    });

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