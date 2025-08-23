import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseLinterImpl, handleZodValidationIssue } from './base.js';
import { getSettingsSchema } from '../lib/schemas.js';
import { detectProjectInfo } from '../lib/project-detection.js';
import type { LintResult, LintOptions, CclintConfig, ProjectInfo } from '../types/index.js';

/**
 * Linter for Claude Code settings.json files
 */
export class SettingsLinter extends BaseLinterImpl {
  name = 'settings';
  description = 'Lint ./claude/settings.json configuration files';

  async lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]> {
    const results: LintResult[] = [];
    
    // Get project info with configuration (use passed projectInfo or detect)
    const info = projectInfo || await detectProjectInfo(projectRoot);
    
    // Look for settings.json in .claude directory
    const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
    
    try {
      await fs.stat(settingsPath);
      const result = await this.lintSettingsFile(settingsPath, info.cclintConfig);
      if (result) {
        results.push(result);
      }
    } catch {
      // settings.json doesn't exist - this might be intentional
      if (options.verbose) {
        const result = this.createResult(settingsPath);
        this.addSuggestion(result, 'No .claude/settings.json found - consider creating one for project-specific configuration');
        results.push(result);
      }
    }

    return results;
  }

  private async lintSettingsFile(filePath: string, config?: CclintConfig): Promise<LintResult | null> {
    const result = this.createResult(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse JSON
      let settings: unknown;
      try {
        settings = JSON.parse(content);
      } catch (parseError) {
        this.addError(result, `Invalid JSON: ${parseError}`);
        return result;
      }

      // Get schema with extensions
      const schema = getSettingsSchema(config);
      const validation = schema.safeParse(settings);

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
      await this.validateAdditional(settings as Record<string, unknown>, result, config);

    } catch (error) {
      this.addError(result, `Failed to read file: ${error}`);
    }

    return result;
  }

  private async validateAdditional(
    settings: Record<string, unknown>, 
    result: LintResult,
    config?: CclintConfig
  ): Promise<void> {
    // Check hooks configuration
    if (settings.hooks && typeof settings.hooks === 'object') {
      this.validateHooksConfig(settings.hooks as Record<string, unknown>, result);
    }

    // Check for common mistakes
    this.checkCommonMistakes(settings, result);

    // Check for deprecated patterns
    this.checkDeprecatedPatterns(settings, result);

    // Run custom validation if configured
    this.runCustomValidation(
      settings, 
      result, 
      config?.settingsSchema?.customValidation
    );
  }

  private validateHooksConfig(
    hooks: Record<string, unknown>, 
    result: LintResult
  ): void {
    // Valid hook events from https://docs.anthropic.com/en/docs/claude-code/hooks
    const validEvents = [
      'PreToolUse',
      'PostToolUse',
      'Notification',
      'UserPromptSubmit',
      'Stop',
      'SubagentStop',
      'SessionEnd',
      'PreCompact',
      'SessionStart'
    ];
    
    for (const [eventType, eventConfig] of Object.entries(hooks)) {
      // Check if event type is valid
      if (!validEvents.includes(eventType)) {
        this.addWarning(result, `Unknown hook event type: ${eventType}`);
      }

      // Validate event configuration
      if (Array.isArray(eventConfig)) {
        for (let i = 0; i < eventConfig.length; i++) {
          this.validateHookEntry(eventConfig[i], `${eventType}[${i}]`, result);
        }
      } else {
        this.addError(result, `${eventType} must be an array of hook configurations`);
      }
    }
  }

  private validateHookEntry(
    entry: unknown, 
    path: string, 
    result: LintResult
  ): void {
    if (typeof entry !== 'object' || entry === null) {
      this.addError(result, `${path}: Hook entry must be an object`);
      return;
    }

    const hookEntry = entry as Record<string, unknown>;

    // Check required fields
    if (!hookEntry.matcher) {
      this.addError(result, `${path}: Missing required field 'matcher'`);
    }

    if (!hookEntry.hooks || !Array.isArray(hookEntry.hooks)) {
      this.addError(result, `${path}: Missing or invalid 'hooks' array`);
    }

    // Validate matcher patterns
    if (typeof hookEntry.matcher === 'string') {
      this.validateMatcher(hookEntry.matcher, path, result);
    }

    // Validate individual hooks
    if (Array.isArray(hookEntry.hooks)) {
      for (let i = 0; i < hookEntry.hooks.length; i++) {
        this.validateIndividualHook(hookEntry.hooks[i], `${path}.hooks[${i}]`, result);
      }
    }
  }

  private validateMatcher(matcher: string, path: string, result: LintResult): void {
    // Check for common matcher patterns
    const commonTools = [
      'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LS',
      'Task', 'NotebookEdit', 'WebFetch', 'WebSearch', 'TodoWrite'
    ];

    // Split by comma or pipe to check individual tools
    const tools = matcher.split(/[,|]/).map(t => t.trim());
    
    for (const tool of tools) {
      if (tool !== '*' && !commonTools.includes(tool) && !tool.includes('*')) {
        // Check if it might be a regex pattern
        if (!tool.includes('.') && !tool.includes('(') && !tool.includes('[')) {
          this.addSuggestion(result, `${path}: Unknown tool in matcher: ${tool}`);
        }
      }
    }
  }

  private validateIndividualHook(
    hook: unknown, 
    path: string, 
    result: LintResult
  ): void {
    if (typeof hook !== 'object' || hook === null) {
      this.addError(result, `${path}: Hook must be an object`);
      return;
    }

    const hookObj = hook as Record<string, unknown>;

    // Check required fields
    if (!hookObj.type) {
      this.addError(result, `${path}: Missing required field 'type'`);
    } else if (hookObj.type !== 'command') {
      this.addWarning(result, `${path}: Unknown hook type '${hookObj.type}', expected 'command'`);
    }

    if (hookObj.command === undefined) {
      this.addError(result, `${path}: Missing required field 'command'`);
    } else if (typeof hookObj.command === 'string') {
      this.validateCommand(hookObj.command, path, result);
    }
  }

  private validateCommand(command: string, path: string, result: LintResult): void {
    // Check for claudekit-hooks pattern
    if (command.startsWith('claudekit-hooks run ')) {
      const hookName = command.replace('claudekit-hooks run ', '');
      this.validateClaudekitHook(hookName, path, result);
    } else {
      // Generic command validation
      if (command.trim() === '') {
        this.addError(result, `${path}: Command cannot be empty`);
      }
    }
  }

  private validateClaudekitHook(hookName: string, path: string, result: LintResult): void {
    // Common claudekit hook names
    const knownHooks = [
      'typecheck-changed', 'typecheck-project',
      'lint-changed', 'lint-project', 
      'test-changed', 'test-project',
      'create-checkpoint', 'check-todos',
      'check-any-changed', 'codebase-map'
    ];

    if (!knownHooks.includes(hookName)) {
      this.addSuggestion(result, `${path}: Unknown claudekit hook: ${hookName}`);
    }
  }

  private checkCommonMistakes(settings: Record<string, unknown>, result: LintResult): void {
    // Check for user-level settings in project config
    if (settings.environmentVariables) {
      this.addWarning(result, 
        'environmentVariables should typically be in user settings (~/.claude/settings.json), not project settings'
      );
    }

    // Check for empty hooks
    if (settings.hooks && typeof settings.hooks === 'object') {
      const hooks = settings.hooks as Record<string, unknown>;
      if (Object.keys(hooks).length === 0) {
        this.addSuggestion(result, 'Empty hooks configuration - consider removing or adding hooks');
      }
    }
  }

  private checkDeprecatedPatterns(settings: Record<string, unknown>, result: LintResult): void {
    // Check for old hook patterns that might be deprecated
    const deprecatedKeys = ['legacyHooks', 'oldHookFormat'];
    
    for (const key of deprecatedKeys) {
      if (settings[key]) {
        this.addWarning(result, `Deprecated configuration key: ${key}`);
      }
    }

    // Check for old matcher formats if we know about them
    if (settings.hooks && typeof settings.hooks === 'object') {
      // This is where we could add checks for deprecated matcher patterns
      // For now, we just ensure the structure is correct
    }
  }
}