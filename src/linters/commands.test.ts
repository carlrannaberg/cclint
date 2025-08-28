import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CommandsLinter } from './commands.js';
import type { LintOptions, ProjectInfo } from '../types/index.js';

describe('CommandsLinter', () => {
  let tempDir: string;
  let commandsDir: string;
  let linter: CommandsLinter;
  let mockOptions: LintOptions;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-commands-test-'));
    commandsDir = path.join(tempDir, '.claude', 'commands');
    await fs.mkdir(commandsDir, { recursive: true });
    
    linter = new CommandsLinter();
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

  describe('valid command files', () => {
    it('should validate a properly formatted command file', async () => {
      const commandContent = `---
description: A test command for validation
allowed-tools: "Bash, Read, Write"
---

# Test Command

This is a test command that does something useful.

\`\`\`bash
echo "Hello world"
\`\`\`
`;

      const commandPath = path.join(commandsDir, 'test-command.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
      expect(results[0].file).toBe(commandPath);
    });

    it('should handle minimal command file with required fields only', async () => {
      const commandContent = `---
# This is a minimal command with no required fields
---

# Minimal Command

This is a minimal command.
`;

      const commandPath = path.join(commandsDir, 'minimal-command.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });

    it('should validate command with all optional fields', async () => {
      const commandContent = `---
description: A comprehensive test command
allowed-tools: "Bash, Read, Write, Edit"
argument-hint: "<filename> [options]"
---

# Full Featured Command

This command demonstrates all supported fields.

Usage: Use $ARGUMENTS to pass parameters to the command.
`;

      const commandPath = path.join(commandsDir, 'full-command.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });
  });

  describe('validation errors', () => {
    it('should pass validation even without any fields (all fields are optional)', async () => {
      const commandContent = `---
# Commands have no required fields - all are optional
---

# Empty Command
`;

      const commandPath = path.join(commandsDir, 'empty-command.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });

    it('should report invalid field types', async () => {
      const commandContent = `---
description: 123  # should be string
allowed-tools: ["Bash", "Read"]  # should be string, not array
argument-hint: 456  # should be string
---

# Invalid Types Command
`;

      const commandPath = path.join(commandsDir, 'invalid-types.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.length).toBeGreaterThan(0);
    });

    it('should report invalid allowed-tools format', async () => {
      const commandContent = `---
description: Command with invalid tools
allowed-tools: ["Bash", "Read"]  # should be string, not array
---

# Invalid Tools Command
`;

      const commandPath = path.join(commandsDir, 'invalid-tools.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('allowed-tools must be a string'))).toBe(true);
    });
  });

  describe('allowed-tools validation', () => {
    it('should accept empty allowed-tools', async () => {
      const commandContent = `---
description: Command with empty tools
allowed-tools: ""
---

# Empty Tools Command
`;

      const commandPath = path.join(commandsDir, 'empty-tools.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
    });

    it('should warn about unknown tools', async () => {
      const commandContent = `---
description: Command with unknown tools
allowed-tools: "UnknownTool, Bash"
---

# Unknown Tools Command
`;

      const commandPath = path.join(commandsDir, 'unknown-tools.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Unknown tool: UnknownTool'))).toBe(true);
    });

    it('should allow MCP tools', async () => {
      const commandContent = `---
description: Command with MCP tools
allowed-tools: "mcp__server__tool, Bash"
---

# MCP Tools Command
`;

      const commandPath = path.join(commandsDir, 'mcp-tools.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.every(warn => !warn.includes('Unknown tool: mcp__server__tool'))).toBe(true);
    });

    it('should validate tool patterns with restrictions', async () => {
      const commandContent = `---
description: Command with tool patterns
allowed-tools: "Bash(git:*), Read(*.json)"
---

# Tool Patterns Command
`;

      const commandPath = path.join(commandsDir, 'tool-patterns.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
    });

    it('should warn about malformed tool patterns', async () => {
      const commandContent = `---
description: Command with malformed tool patterns
allowed-tools: "Bash(invalid), Read(unclosed"
---

# Bad Patterns Command
`;

      const commandPath = path.join(commandsDir, 'bad-patterns.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      // Should have warnings about invalid patterns
      expect(results[0].warnings.length).toBeGreaterThan(0);
    });
  });

  describe('bash command usage detection', () => {
    it('should warn when bash commands are used without Bash in allowed-tools', async () => {
      const commandContent = `---

description: Command that uses bash without permission
allowed-tools: "Read, Write"
---

# Bash Usage Command

This command executes: !\`ls -la\`
`;

      const commandPath = path.join(commandsDir, 'bash-usage.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('bash command execution') && warn.includes('Bash'))).toBe(true);
    });

    it('should not warn when bash commands are used with Bash in allowed-tools', async () => {
      const commandContent = `---

description: Command that properly allows bash
allowed-tools: "Bash, Read, Write"
---

# Bash Allowed Command

This command executes: !\`ls -la\`
`;

      const commandPath = path.join(commandsDir, 'bash-allowed.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.every(warn => !warn.includes('bash command execution'))).toBe(true);
    });

    it('should detect various bash command patterns', async () => {
      const commandContent = `---

description: Command with various bash patterns
allowed-tools: "Write"  # Missing Bash
---

# Bash Patterns Command

Execute: !\`echo "test"\`
Run: ! \`pwd\`
Also: !\`git status\`
`;

      const commandPath = path.join(commandsDir, 'bash-patterns.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('bash command execution'))).toBe(true);
    });
  });

  describe('file reference detection', () => {
    it('should suggest Read tool when file references are used', async () => {
      const commandContent = `---

description: Command that references files
allowed-tools: "Bash, Write"  # Missing Read
---

# File References Command

Check the file @src/main.ts and @package.json for details.
Also look at @config/settings.yml
`;

      const commandPath = path.join(commandsDir, 'file-refs.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('@file references') && sugg.includes('Read'))).toBe(true);
    });

    it('should not suggest Read tool when already included', async () => {
      const commandContent = `---

description: Command with proper Read permission
allowed-tools: "Bash, Read, Write"
---

# File References OK Command

Check the file @src/main.ts for details.
`;

      const commandPath = path.join(commandsDir, 'file-refs-ok.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.every(sugg => !sugg.includes('@file references'))).toBe(true);
    });
  });

  describe('suggestions', () => {
    it('should suggest description when missing and first line is available', async () => {
      const commandContent = `---

---

This command does something useful but has no description field.

More content here.
`;

      const commandPath = path.join(commandsDir, 'no-description.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('Consider adding description field'))).toBe(true);
    });

    it('should suggest argument-hint when $ARGUMENTS is used without it', async () => {
      const commandContent = `---

description: Command that uses arguments
---

# Arguments Usage Command

This command processes $ARGUMENTS to do its work.
`;

      const commandPath = path.join(commandsDir, 'arguments-usage.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('$ARGUMENTS') && sugg.includes('argument-hint'))).toBe(true);
    });

    it('should not suggest argument-hint when already provided', async () => {
      const commandContent = `---

description: Command with proper argument hint
argument-hint: "<filename> [options]"
---

# Arguments OK Command

This command processes $ARGUMENTS properly.
`;

      const commandPath = path.join(commandsDir, 'arguments-ok.md');
      await fs.writeFile(commandPath, commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.every(sugg => !sugg.includes('$ARGUMENTS'))).toBe(true);
    });
  });

  describe('file discovery', () => {
    it('should find commands in multiple directories', async () => {
      // Create commands in different directories
      const srcCommandsDir = path.join(tempDir, 'src', 'commands');
      const rootCommandsDir = path.join(tempDir, 'commands');
      
      await fs.mkdir(srcCommandsDir, { recursive: true });
      await fs.mkdir(rootCommandsDir, { recursive: true });

      const commandContent = `---

description: Test command
---

# Test Command
`;

      await fs.writeFile(path.join(commandsDir, 'command1.md'), commandContent);
      await fs.writeFile(path.join(srcCommandsDir, 'command2.md'), commandContent);
      await fs.writeFile(path.join(rootCommandsDir, 'command3.md'), commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should skip files without frontmatter', async () => {
      const regularMdContent = `# Regular Markdown

This is just a regular markdown file without frontmatter.
`;

      const commandContent = `---

description: Real command
---

# Real Command
`;

      await fs.writeFile(path.join(commandsDir, 'regular.md'), regularMdContent);
      await fs.writeFile(path.join(commandsDir, 'command.md'), commandContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('command.md');
    });
  });

  describe('custom validation', () => {
    it('should run custom validation when configured', async () => {
      const commandContent = `---

description: Custom validation test
customField: "forbidden"
---

# Custom Test Command
`;

      const commandPath = path.join(commandsDir, 'custom-test.md');
      await fs.writeFile(commandPath, commandContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          commandSchema: {
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
      const commandContent = `---

description: Custom validation error test
---

# Custom Error Command
`;

      const commandPath = path.join(commandsDir, 'custom-error.md');
      await fs.writeFile(commandPath, commandContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          commandSchema: {
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

  describe('configuration patterns', () => {
    it('should respect include patterns', async () => {
      const customDir = path.join(tempDir, 'custom', 'commands');
      await fs.mkdir(customDir, { recursive: true });

      const commandContent = `---

description: Command in custom location
---

# Custom Location Command
`;

      await fs.writeFile(path.join(customDir, 'custom.md'), commandContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: false,
        hasPackageJson: false,
        cclintConfig: {
          rules: {
            includePatterns: ['custom/commands']
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('custom.md');
    });

    it('should respect exclude patterns', async () => {
      const commandContent = `---

description: Test command
---

# Test Command
`;

      await fs.writeFile(path.join(commandsDir, 'excluded.md'), commandContent);
      await fs.writeFile(path.join(commandsDir, 'included.md'), commandContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          rules: {
            excludePatterns: ['**/excluded.md']
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('included.md');
      expect(results.every(r => !r.file.includes('excluded.md'))).toBe(true);
    });
  });
});