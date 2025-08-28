import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AgentsLinter } from './agents.js';
import type { LintOptions, ProjectInfo } from '../types/index.js';

describe('AgentsLinter', () => {
  let tempDir: string;
  let agentsDir: string;
  let linter: AgentsLinter;
  let mockOptions: LintOptions;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-agents-test-'));
    agentsDir = path.join(tempDir, '.claude', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    
    // Create a custom config that allows the extended fields
    const configContent = `import { z } from 'zod';

export default {
  agentSchema: {
    extend: {
      category: z.enum(['testing', 'general', 'framework', 'database', 'frontend', 'devops', 'build', 'linting', 'tools', 'universal']).optional(),
      priority: z.number().min(1).max(5).optional(),
      tags: z.array(z.string()).optional(),
    }
  }
};`;
    
    const configPath = path.join(tempDir, 'cclint.config.js');
    await fs.writeFile(configPath, configContent);
    
    linter = new AgentsLinter();
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

  describe('valid agent files', () => {
    it('should validate a properly formatted agent file', async () => {
      const agentContent = `---
name: test-agent
description: A test agent for validation
tools: "Bash, Read, Write"
---

# Test Agent

This is a test agent for validation purposes.
`;

      const agentPath = path.join(agentsDir, 'test-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
      expect(results[0].file).toBe(agentPath);
    });

    it('should handle minimal agent file with required fields only', async () => {
      const agentContent = `---
name: minimal-agent
description: Minimal test agent
---

# Minimal Agent
`;

      const agentPath = path.join(agentsDir, 'minimal-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });

    it('should validate agent with all optional fields', async () => {
      const agentContent = `---
name: full-agent
description: A comprehensive test agent
category: testing
tools: "Bash, Read, Write, Edit"
color: "blue"
priority: 3
tags: ["core", "extended"]
---

# Full Featured Agent

This agent demonstrates all supported fields.
`;

      const agentPath = path.join(agentsDir, 'full-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });
  });

  describe('validation errors', () => {
    it('should report missing required fields', async () => {
      const agentContent = `---
name: incomplete-agent
# missing description (required field)
---

# Incomplete Agent
`;

      const agentPath = path.join(agentsDir, 'incomplete-agent.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.length).toBeGreaterThan(0);
      expect(results[0].missingFields).toContain('description');
    });

    it('should report invalid field types', async () => {
      const agentContent = `---
name: invalid-types
description: Test agent
category: "invalid-category"  # should be one of the enum values
color: 123  # should be string
tags: "not an array"  # should be array
---

# Invalid Types Agent
`;

      const agentPath = path.join(agentsDir, 'invalid-types.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.length).toBeGreaterThan(0);
    });

    it('should accept array tools format', async () => {
      const agentContent = `---
name: array-tools
description: Agent with array tools
tools: ["Bash", "Read"]
---

# Array Tools Agent
`;

      const agentPath = path.join(agentsDir, 'array-tools.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
    });
  });

  describe('tool validation', () => {
    it('should warn about empty tools field', async () => {
      const agentContent = `---
name: empty-tools
description: Agent with empty tools
tools: ""
---

# Empty Tools Agent
`;

      const agentPath = path.join(agentsDir, 'empty-tools.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Empty tools field'))).toBe(true);
    });

    it('should warn about unknown tools', async () => {
      const agentContent = `---
name: unknown-tools
description: Agent with unknown tools
tools: "UnknownTool, Bash"
---

# Unknown Tools Agent
`;

      const agentPath = path.join(agentsDir, 'unknown-tools.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Unknown tool: UnknownTool'))).toBe(true);
    });

    it('should allow MCP tools', async () => {
      const agentContent = `---
name: mcp-tools
description: Agent with MCP tools
tools: "mcp__server__tool, Bash"
---

# MCP Tools Agent
`;

      const agentPath = path.join(agentsDir, 'mcp-tools.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.every(warn => !warn.includes('Unknown tool: mcp__server__tool'))).toBe(true);
    });

    it('should validate tool parentheses matching', async () => {
      const agentContent = `---
name: parentheses-tools
description: Agent with mismatched parentheses
tools: "Bash(git:*, Read(pattern"
---

# Parentheses Tools Agent
`;

      const agentPath = path.join(agentsDir, 'parentheses-tools.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings.some(warn => warn.includes('Unmatched parentheses'))).toBe(true);
    });
  });

  describe('color validation', () => {
    it('should reject hex colors', async () => {
      const agentContent = `---
name: hex-color
description: Agent with hex color
color: "#FF5733"
---

# Hex Color Agent
`;

      const agentPath = path.join(agentsDir, 'hex-color.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('not a valid Claude Code color'))).toBe(true);
    });

    it('should accept valid CSS named colors', async () => {
      const agentContent = `---
name: named-color
description: Agent with named color
color: "blue"
---

# Named Color Agent
`;

      const agentPath = path.join(agentsDir, 'named-color.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.every(sugg => !sugg.includes('not a standard CSS named color'))).toBe(true);
    });

    it('should reject invalid color names', async () => {
      const agentContent = `---
name: invalid-color
description: Agent with invalid color
color: "brown"
---

# Invalid Color Agent
`;

      const agentPath = path.join(agentsDir, 'invalid-color.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('not a valid Claude Code color'))).toBe(true);
    });
  });

  describe('suggestions', () => {
    it('should suggest when name does not match filename', async () => {
      const agentContent = `---
name: different-name
description: Agent with different name
---

# Different Name Agent
`;

      const agentPath = path.join(agentsDir, 'actual-filename.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('doesn\'t match filename'))).toBe(true);
    });

    it('should detect duplicate description in content', async () => {
      const description = 'This is a test description';
      const agentContent = `---
name: duplicate-description
description: "${description}"
---

${description}

Additional content here.
`;

      const agentPath = path.join(agentsDir, 'duplicate-description.md');
      await fs.writeFile(agentPath, agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions.some(sugg => sugg.includes('Description is duplicated'))).toBe(true);
    });
  });

  describe('file discovery', () => {
    it('should find agents in multiple directories', async () => {
      // Create agents in different directories
      const srcAgentsDir = path.join(tempDir, 'src', 'agents');
      const rootAgentsDir = path.join(tempDir, 'agents');
      
      await fs.mkdir(srcAgentsDir, { recursive: true });
      await fs.mkdir(rootAgentsDir, { recursive: true });

      const agentContent = `---
name: test-agent
description: Test agent
---

# Test Agent
`;

      await fs.writeFile(path.join(agentsDir, 'agent1.md'), agentContent);
      await fs.writeFile(path.join(srcAgentsDir, 'agent2.md'), agentContent);
      await fs.writeFile(path.join(rootAgentsDir, 'agent3.md'), agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should skip files without frontmatter', async () => {
      const regularMdContent = `# Regular Markdown

This is just a regular markdown file without frontmatter.
`;

      const agentContent = `---
name: real-agent
description: Real agent
---

# Real Agent
`;

      await fs.writeFile(path.join(agentsDir, 'regular.md'), regularMdContent);
      await fs.writeFile(path.join(agentsDir, 'agent.md'), agentContent);

      const results = await linter.lint(tempDir, mockOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('agent.md');
    });
  });

  describe('custom validation', () => {
    it('should run custom validation when configured', async () => {
      const agentContent = `---
name: custom-test
description: Custom validation test
customField: "test"
---

# Custom Test Agent
`;

      const agentPath = path.join(agentsDir, 'custom-test.md');
      await fs.writeFile(agentPath, agentContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          agentSchema: {
            customValidation: (data) => {
              const errors: string[] = [];
              if (data.customField === 'test') {
                errors.push('Custom field should not be "test"');
              }
              return errors;
            }
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors.some(err => err.includes('Custom validation: Custom field should not be "test"'))).toBe(true);
    });

    it('should handle custom validation errors gracefully', async () => {
      const agentContent = `---
name: custom-error
description: Custom validation error test
---

# Custom Error Agent
`;

      const agentPath = path.join(agentsDir, 'custom-error.md');
      await fs.writeFile(agentPath, agentContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: true,
        hasPackageJson: false,
        cclintConfig: {
          agentSchema: {
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
      const customDir = path.join(tempDir, 'custom', 'agents');
      await fs.mkdir(customDir, { recursive: true });

      const agentContent = `---
name: custom-location
description: Agent in custom location
---

# Custom Location Agent
`;

      await fs.writeFile(path.join(customDir, 'custom.md'), agentContent);

      const mockProjectInfo: ProjectInfo = {
        root: tempDir,
        hasGit: false,
        hasClaudeDir: false,
        hasPackageJson: false,
        cclintConfig: {
          rules: {
            includePatterns: ['custom/agents']
          }
        }
      };

      const results = await linter.lint(tempDir, mockOptions, mockProjectInfo);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('custom.md');
    });

    it('should respect exclude patterns', async () => {
      const agentContent = `---
name: excluded-agent
description: Agent that should be excluded
---

# Excluded Agent
`;

      await fs.writeFile(path.join(agentsDir, 'excluded.md'), agentContent);
      await fs.writeFile(path.join(agentsDir, 'included.md'), agentContent);

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