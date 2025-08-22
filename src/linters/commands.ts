import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { BaseLinterImpl, hasFrontmatter, validateToolPattern, shouldSkipFile, handleZodValidationIssue } from './base.js';
import { getCommandSchema, KNOWN_CLAUDE_TOOLS } from '../lib/schemas.js';
import { detectProjectInfo } from '../lib/project-detection.js';
import type { LintResult, LintOptions, FrontmatterData, CclintConfig, ProjectInfo } from '../types/index.js';

/**
 * Linter for Claude Code command markdown files
 */
export class CommandsLinter extends BaseLinterImpl {
  name = 'commands';
  description = 'Lint slash command definition files';

  async lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]> {
    const results: LintResult[] = [];
    
    // Get project info with configuration (use passed projectInfo or detect)
    const info = projectInfo || await detectProjectInfo(projectRoot);
    
    // Look for command files in common locations
    const commandDirs = [
      path.join(projectRoot, '.claude', 'commands'),
      path.join(projectRoot, 'src', 'commands'), 
      path.join(projectRoot, 'commands'),
    ];

    // Add custom include patterns if specified
    if (info.cclintConfig?.rules?.includePatterns) {
      for (const pattern of info.cclintConfig.rules.includePatterns) {
        commandDirs.push(path.join(projectRoot, pattern));
      }
    }

    for (const commandDir of commandDirs) {
      try {
        const pattern = path.join(commandDir, '**/*.md');
        const files = await glob(pattern);
        
        for (const file of files) {
          // Skip excluded patterns
          if (shouldSkipFile(file, info.cclintConfig?.rules?.excludePatterns)) {
            continue;
          }
          
          const result = await this.lintCommandFile(file, info.cclintConfig);
          if (result) {
            results.push(result);
          }
        }
      } catch {
        // Directory doesn't exist or isn't accessible
      }
    }

    return results;
  }

  private async lintCommandFile(filePath: string, config?: CclintConfig): Promise<LintResult | null> {
    const result = this.createResult(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Skip files without frontmatter
      if (!hasFrontmatter(content)) {
        return null;
      }

      const { data: frontmatter, content: markdown } = matter(content);

      // Get schema with extensions
      const schema = getCommandSchema(config);
      const validation = schema.safeParse(frontmatter);

      if (!validation.success) {
        this.markInvalid(result);

        for (const issue of validation.error.issues) {
          handleZodValidationIssue(
            issue,
            result,
            this.addError.bind(this),
            this.addWarning.bind(this),
            this.addMissingField.bind(this),
            this.addUnusedField.bind(this)
          );
        }
      }

      // Additional validations
      await this.validateAdditional(frontmatter, markdown, result, config);

    } catch (error) {
      this.addError(result, `Failed to parse file: ${error}`);
    }

    return result;
  }

  private async validateAdditional(
    frontmatter: Record<string, unknown>, 
    markdown: string, 
    result: LintResult,
    config?: CclintConfig
  ): Promise<void> {
    // Validate allowed-tools field
    if (frontmatter['allowed-tools']) {
      this.validateAllowedTools(frontmatter['allowed-tools'], result);
    }

    // Check bash command usage
    this.checkBashCommandUsage(frontmatter, markdown, result);

    // Check file references
    this.checkFileReferences(frontmatter, markdown, result);

    // Check if description is missing and suggest using first line
    if (!frontmatter.description && markdown.trim() !== '') {
      const firstLine = markdown.trim().split('\n')[0];
      if (firstLine && firstLine !== '' && !firstLine.startsWith('#')) {
        this.addSuggestion(result, 
          `Consider adding description field (could use: "${firstLine.slice(0, 50)}...")`
        );
      }
    }

    // Check for $ARGUMENTS usage without argument-hint
    if (markdown.includes('$ARGUMENTS') && !frontmatter['argument-hint']) {
      this.addSuggestion(result, 'Command uses $ARGUMENTS but no argument-hint is provided');
    }

    // Run custom validation if configured
    if (config?.commandSchema?.customValidation) {
      try {
        const customErrors = config.commandSchema.customValidation(frontmatter as FrontmatterData);
        for (const error of customErrors) {
          if (!result.customSchemaErrors) {
            result.customSchemaErrors = [];
          }
          result.customSchemaErrors.push(error);
          this.addError(result, `Custom validation: ${error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.addError(result, `Custom validation failed: ${errorMessage}`);
        if (process.env.CCLINT_VERBOSE) {
          console.error(`Custom validation error in ${this.name}:`, error);
        }
      }
    }
  }

  private validateAllowedTools(allowedTools: unknown, result: LintResult): void {
    if (typeof allowedTools !== 'string') {
      this.addError(result, 'allowed-tools must be a string');
      return;
    }

    if (allowedTools === '') {
      return; // Empty is valid
    }

    // Parse tools - they can have restrictions like Bash(git:*)
    const toolList = allowedTools.split(',').map((t) => t.trim());

    for (const tool of toolList) {
      // Extract base tool name (e.g., "Bash(git:*)" -> "Bash")
      const baseTool = tool.split('(')[0]?.trim() ?? '';

      // Check if it's an MCP tool (format: mcp__<server>__<tool>)
      const isMcpTool = baseTool.startsWith('mcp__');

      // Check if it's a known tool or MCP tool
      if (baseTool !== '' && !KNOWN_CLAUDE_TOOLS.has(baseTool) && !isMcpTool) {
        this.addWarning(result, `Unknown tool: ${baseTool}`);
      }

      // Validate tool pattern syntax
      const patternWarnings = validateToolPattern(tool);
      for (const warning of patternWarnings) {
        this.addWarning(result, warning);
      }
    }
  }

  private checkBashCommandUsage(
    frontmatter: Record<string, unknown>,
    markdown: string, 
    result: LintResult
  ): void {
    // Look for bash command execution patterns
    const bashCommandPattern = /!\s*`[^`]+`/g;
    const hasBashCommands = bashCommandPattern.test(markdown);

    if (hasBashCommands) {
      // Check if allowed-tools includes Bash
      const allowedTools = frontmatter['allowed-tools'] as string | undefined;

      if (!allowedTools || !allowedTools.includes('Bash')) {
        this.addWarning(result, 
          'File uses bash command execution (!`command`) but allowed-tools does not include Bash'
        );
      }
    }
  }

  private checkFileReferences(
    frontmatter: Record<string, unknown>,
    markdown: string, 
    result: LintResult
  ): void {
    // Look for file reference patterns
    const fileRefPattern = /@[^\s]+\.(js|ts|jsx|tsx|md|json|yml|yaml)/g;
    const hasFileRefs = fileRefPattern.test(markdown);

    if (hasFileRefs) {
      const allowedTools = frontmatter['allowed-tools'] as string | undefined;

      if (!allowedTools || !allowedTools.includes('Read')) {
        this.addSuggestion(result, 
          'File uses @file references but allowed-tools does not include Read'
        );
      }
    }
  }
}