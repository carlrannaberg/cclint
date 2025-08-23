/**
 * @fileoverview Linter for Claude Code agent and subagent definition files.
 * 
 * This module provides comprehensive validation for agent markdown files,
 * including frontmatter validation, schema checking, and Claude-specific rules.
 * 
 * @author CClint Team
 * @version 1.0.0
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { BaseLinterImpl, hasFrontmatter, validateColor, shouldSkipFile, handleZodValidationIssue } from './base.js';
import { getAgentSchema, KNOWN_CLAUDE_TOOLS, CSS_NAMED_COLORS } from '../lib/schemas.js';
import { detectProjectInfo } from '../lib/project-detection.js';
import type { LintResult, LintOptions, FrontmatterData, CclintConfig, ProjectInfo } from '../types/index.js';

/**
 * Linter for Claude Code agent and subagent definition files.
 * 
 * Validates agent markdown files for:
 * - Required frontmatter fields (name, description)
 * - Optional fields (tools, model, category, color, displayName, bundle)
 * - Tool pattern validation
 * - Color format validation (hex or CSS named colors)
 * - Custom schema extensions via configuration
 * 
 * @extends {BaseLinterImpl}
 */
export class AgentsLinter extends BaseLinterImpl {
  name = 'agents';
  description = 'Lint agent and subagent definition files';

  /**
   * Lint all agent definition files in the project.
   * 
   * Searches for markdown files in standard agent directories:
   * - .claude/agents
   * - src/agents
   * - agents
   * 
   * Plus any custom include patterns from configuration.
   * 
   * @param {string} projectRoot - Absolute path to the project root directory
   * @param {LintOptions} options - Linting options including parallel processing settings
   * @param {ProjectInfo} [projectInfo] - Pre-detected project information (optional)
   * @returns {Promise<LintResult[]>} Array of lint results for each processed file
   * @throws {Error} If project root is invalid or inaccessible
   */
  async lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]> {
    // Get project info with configuration (use passed projectInfo or detect)
    const info = projectInfo || await detectProjectInfo(projectRoot);
    
    // Look for agent files in common locations
    const agentDirs = [
      path.join(projectRoot, '.claude', 'agents'),
      path.join(projectRoot, 'src', 'agents'), 
      path.join(projectRoot, 'agents'),
    ];

    // Find all markdown files in the agent directories
    const files = await this.findMarkdownFilesInDirectories(projectRoot, agentDirs, info.cclintConfig);
    
    // Lint each file using the common pattern with parallel processing support
    return await this.lintFiles(
      files, 
      (file, config) => this.lintAgentFile(file, config), 
      info.cclintConfig,
      { 
        parallel: options.parallel !== false, // Default to true unless explicitly disabled
        concurrency: options.concurrency || 10 
      }
    );
  }

  private async lintAgentFile(filePath: string, config?: CclintConfig): Promise<LintResult | null> {
    const result = this.createResult(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Skip files without frontmatter
      if (!hasFrontmatter(content)) {
        return null;
      }

      const { data: frontmatter, content: markdown } = matter(content);

      // Get schema with extensions
      const schema = getAgentSchema(config);
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
      await this.validateAdditional(frontmatter, markdown, result, filePath, config);

    } catch (error) {
      this.addError(result, `Failed to parse file: ${error}`);
    }

    return result;
  }

  private async validateAdditional(
    frontmatter: Record<string, unknown>, 
    markdown: string, 
    result: LintResult, 
    filePath: string,
    config?: CclintConfig
  ): Promise<void> {
    // Validate tools field
    if (frontmatter.tools !== undefined) {
      this.validateTools(frontmatter.tools, result);
    }

    // Validate color field
    if (frontmatter.color && typeof frontmatter.color === 'string') {
      this.validateColorField(frontmatter.color, result);
    }

    // Check name matches filename
    if (frontmatter.name && typeof frontmatter.name === 'string') {
      this.checkNameMatchesFilename(frontmatter.name, filePath, result);
    }

    // Check for displayName suggestion
    if (!frontmatter.displayName && frontmatter.name && typeof frontmatter.name === 'string') {
      this.addSuggestion(result, 'Consider adding displayName for better UI presentation');
    }

    // Check for duplicate description in content
    if (frontmatter.description && typeof frontmatter.description === 'string' && markdown.trim().startsWith(frontmatter.description)) {
      this.addSuggestion(result, 'Description is duplicated in markdown content');
    }

    // Check bundle field format
    if (frontmatter.bundle && typeof frontmatter.bundle === 'string') {
      this.addSuggestion(result, 'bundle field should be an array, not a string');
    }

    // Run custom validation if configured
    this.runCustomValidation(
      frontmatter as FrontmatterData, 
      result, 
      config?.agentSchema?.customValidation
    );
  }

  private validateTools(tools: unknown, result: LintResult): void {
    if (tools === null || tools === '') {
      this.addWarning(result, 'Empty tools field - this will grant NO tools. Remove the field entirely to inherit all tools, or specify tools explicitly');
      return;
    }

    if (Array.isArray(tools)) {
      this.addError(result, 'tools field must be a comma-separated string, not an array');
      return;
    }

    if (typeof tools !== 'string') {
      this.addError(result, 'tools field must be a string');
      return;
    }

    // Parse and validate individual tools
    const toolList = tools.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    
    if (toolList.length === 0) {
      this.addWarning(result, 'Empty tools field detected - this will grant NO tools');
      return;
    }

    for (const tool of toolList) {
      // Extract base tool name (e.g., "Bash(git:*)" -> "Bash")
      const baseTool = tool.split('(')[0]?.trim() ?? '';
      
      // Check if it's a known tool or wildcard
      if (baseTool !== '' && !KNOWN_CLAUDE_TOOLS.has(baseTool) && baseTool !== '*') {
        // Check if it's an MCP tool (format: mcp__<server>__<tool>)
        if (!baseTool.startsWith('mcp__')) {
          this.addWarning(result, `Unknown tool: ${baseTool}`);
        }
      }

      // Check for proper parenthesis matching
      const openParens = (tool.match(/\(/g) || []).length;
      const closeParens = (tool.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        this.addWarning(result, `Unmatched parentheses in tool specification: ${tool}`);
      }
    }
  }

  private validateColorField(color: string, result: LintResult): void {
    if (!validateColor(color, CSS_NAMED_COLORS)) {
      if (color.startsWith('#')) {
        this.addWarning(result, `Invalid hex color format: "${color}" (should be #RRGGBB or #RRGGBBAA)`);
      } else {
        this.addWarning(result, `Color "${color}" is not a valid CSS color`);
      }
    }
  }

  private checkNameMatchesFilename(name: string, filePath: string, result: LintResult): void {
    const expectedName = path.basename(filePath, '.md');
    if (name !== expectedName && !name.endsWith('-expert')) {
      this.addSuggestion(result, `name "${name}" doesn't match filename "${expectedName}"`);
    }
  }
}