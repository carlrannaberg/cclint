import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SettingsLinter } from './settings.js';
import type { LintOptions, ProjectInfo } from '../types/index.js';

describe('SettingsLinter', () => {
  let tempDir: string;
  let claudeDir: string;
  let linter: SettingsLinter;
  let mockOptions: LintOptions;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-settings-test-'));
    claudeDir = path.join(tempDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    
    linter = new SettingsLinter();
    mockOptions = {
      quiet: true,
      verbose: false,
      format: 'console',
      failOn: 'error',
      customSchemas: true,
    };
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('valid settings files', () => {
    it('should validate a properly formatted settings file', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read,Write,Edit",
              hooks: [
                {
                  type: "command",
                  command: "npm run typecheck"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
      expect(results[0].file).toBe(settingsPath);
    });

    it('should validate minimal settings file', async () => {
      const settingsContent = JSON.stringify({
        hooks: {}
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
    });

    it('should validate settings with multiple hook events', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "npm run lint"
                }
              ]
            }
          ],
          PreToolUse: [
            {
              matcher: "*",
              hooks: [
                {
                  type: "command",
                  command: "git stash"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });
  });

  describe('JSON parsing errors', () => {
    it('should report invalid JSON syntax', async () => {
      const invalidJson = `{
        "hooks": {
          "PostToolUse": [
            {
              "matcher": "Read",
              "hooks": [
                // This comment makes it invalid JSON
                {
                  "type": "command",
                  "command": "test"
                }
              ]
            }
          ]
        }`;

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, invalidJson);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Invalid JSON'))).toBe(true);
    });

    it('should report malformed JSON', async () => {
      const malformedJson = `{"hooks": {"PostToolUse": [{"matcher": "Read"]}`;

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, malformedJson);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Invalid JSON'))).toBe(true);
    });
  });

  describe('hooks validation', () => {
    it('should warn about unknown hook event types', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          UnknownEvent: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "command",
                  command: "test command"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Unknown hook event type: UnknownEvent'))).toBe(true);
    });

    it('should validate hook event must be array', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: {
            matcher: "Read",
            hooks: []
          }
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('must be an array of hook configurations'))).toBe(true);
    });

    it('should validate hook entry structure', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              // missing matcher
              hooks: [
                {
                  type: "command",
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Missing required field \'matcher\''))).toBe(true);
    });

    it('should validate hooks array is required', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read"
              // missing hooks array
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Missing or invalid \'hooks\' array'))).toBe(true);
    });
  });

  describe('matcher validation', () => {
    it('should accept common tool names in matchers', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read,Write,Edit,MultiEdit,Bash",
              hooks: [
                {
                  type: "command",
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.every(sugg => !sugg.includes('Unknown tool in matcher'))).toBe(true);
    });

    it('should suggest unknown tools in matchers', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "UnknownTool,Read",
              hooks: [
                {
                  type: "command",
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('Unknown tool in matcher: UnknownTool'))).toBe(true);
    });

    it('should accept wildcard and pattern matchers', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "*",
              hooks: [
                {
                  type: "command",
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.every(sugg => !sugg.includes('Unknown tool'))).toBe(true);
    });
  });

  describe('individual hook validation', () => {
    it('should validate hook type field', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  // missing type
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Missing required field \'type\''))).toBe(true);
    });

    it('should validate hook command field', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "command"
                  // missing command
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Missing required field \'command\''))).toBe(true);
    });

    it('should warn about unknown hook types', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "unknown-type",
                  command: "test"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Unknown hook type \'unknown-type\''))).toBe(true);
    });

    it('should validate empty commands', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "command",
                  command: ""
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Command cannot be empty'))).toBe(true);
    });
  });

  describe('command validation', () => {
    it('should accept any non-empty command', async () => {
      const commands = [
        'npm run typecheck',
        'git status',
        'npm test',
        'echo "hello"',
        'custom-script.sh'
      ];

      for (const command of commands) {
        const settingsContent = JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                matcher: "Read",
                hooks: [
                  {
                    type: "command",
                    command: command
                  }
                ]
              }
            ]
          }
        }, null, 2);

        const settingsPath = path.join(claudeDir, 'settings.json');
        await fs.writeFile(settingsPath, settingsContent);

        const results = await linter.lint(tempDir, mockOptions);
        
        expect(results).toHaveLength(1);
        // Should not have any errors or warnings about the command itself
        expect(results[0].errors).toHaveLength(0);
        expect(results[0].warnings).toHaveLength(0);
      }
    });

    it('should only validate that commands are not empty', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read",
              hooks: [
                {
                  type: "command",
                  command: "   "  // Empty/whitespace command
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].errors.some(err => err.includes('Command cannot be empty'))).toBe(true);
    });
  });

  describe('common mistakes detection', () => {
    it('should warn about environmentVariables in project settings', async () => {
      const settingsContent = JSON.stringify({
        environmentVariables: {
          "API_KEY": "secret"
        },
        hooks: {}
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('environmentVariables should typically be in user settings'))).toBe(true);
    });

    it('should suggest removing empty hooks configuration', async () => {
      const settingsContent = JSON.stringify({
        hooks: {}
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('Empty hooks configuration'))).toBe(true);
    });
  });

  describe('deprecated patterns detection', () => {
    it('should warn about deprecated configuration keys', async () => {
      const settingsContent = JSON.stringify({
        hooks: {},
        legacyHooks: {
          PostToolUse: []
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Deprecated configuration key: legacyHooks'))).toBe(true);
    });
  });

  describe('missing settings file', () => {
    it('should not report anything when settings.json is missing in quiet mode', async () => {
      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(0);
    });

    it('should suggest creating settings.json in verbose mode', async () => {
      const verboseOptions = { ...mockOptions, verbose: true };
      const results = await linter.lint(tempDir, verboseOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('No .claude/settings.json found'))).toBe(true);
    });
  });

  describe('custom validation', () => {
    it('should run custom validation when configured', async () => {
      const settingsContent = JSON.stringify({
        hooks: {},
        customField: "forbidden"
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          settingsSchema: {
            customValidation: (data) => {
              const errors: string[] = [];
              if (data.customField === 'forbidden') {
                errors.push('Custom field cannot be "forbidden"');
              }
              return errors;
            }
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Custom validation: Custom field cannot be "forbidden"'))).toBe(true);
    });

    it('should handle custom validation errors gracefully', async () => {
      const settingsContent = JSON.stringify({
        hooks: {}
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          settingsSchema: {
            customValidation: () => {
              throw new Error('Custom validation threw an error');
            }
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Custom validation failed'))).toBe(true);
    });
  });

  describe('complex hook configurations', () => {
    it('should validate complex multi-hook configuration', async () => {
      const settingsContent = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Read,Write",
              hooks: [
                {
                  type: "command",
                  command: "npm run lint"
                },
                {
                  type: "command",
                  command: "npm run typecheck"
                }
              ]
            },
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "npm test"
                }
              ]
            }
          ],
          PreToolUse: [
            {
              matcher: "*",
              hooks: [
                {
                  type: "command",
                  command: "echo 'Tool about to be used'"
                }
              ]
            }
          ]
        }
      }, null, 2);

      const settingsPath = path.join(claudeDir, 'settings.json');
      await fs.writeFile(settingsPath, settingsContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });
  });
});