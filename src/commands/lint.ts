import ora from 'ora';
import { AgentsLinter } from '../linters/agents.js';
import { CommandsLinter } from '../linters/commands.js';
import { SettingsLinter } from '../linters/settings.js';
import { ClaudeMdLinter } from '../linters/claude-md.js';
import { ConsoleReporter } from '../reporters/console.js';
import { JsonReporter } from '../reporters/json.js';
import { MarkdownReporter } from '../reporters/markdown.js';
import { findProjectRoot, detectProjectInfo } from '../lib/project-detection.js';
import { calculateSummary, writeReportToFile, getExitCode } from '../lib/utils.js';
import type { LintOptions, LintResult, BaseLinter, LintSummary } from '../types/index.js';

/**
 * Main lint command implementation
 */
export async function lintCommand(options: LintOptions): Promise<void> {
  const startTime = Date.now();
  let spinner: ReturnType<typeof ora> | null = null;

  try {
    // Find project root
    const projectRoot = options.root ? options.root : await findProjectRoot();
    
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