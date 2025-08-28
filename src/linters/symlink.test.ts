import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AgentsLinter } from './agents.js';
import { CommandsLinter } from './commands.js';
import { CClint } from '../lib/sdk.js';
import * as utils from '../lib/utils.js';
import type { LintOptions } from '../types/index.js';
import * as os from 'os';

describe('Symlink Support', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-symlink-test-'));
    projectRoot = tempDir;

    // Create directory structure
    await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.claude', 'agents'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.claude', 'commands'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'actual-agents'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'actual-commands'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'outside'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('AgentsLinter with symlinks', () => {
    it('should NOT follow symlinks by default', async () => {
      // Create actual agent file
      const actualAgentPath = path.join(tempDir, 'actual-agents', 'test-agent.md');
      await fs.writeFile(actualAgentPath, `---
name: test-agent
description: Test agent
---
Content`);

      // Create symlink
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'test-agent.md');
      await fs.symlink(actualAgentPath, symlinkPath);

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: false };
      
      const results = await linter.lint(tempDir, options);
      
      // Should not find the symlinked file
      expect(results).toHaveLength(0);
    });

    it('should follow symlinks when explicitly enabled', async () => {
      // Create actual agent file
      const actualAgentPath = path.join(tempDir, 'actual-agents', 'test-agent.md');
      await fs.writeFile(actualAgentPath, `---
name: test-agent
description: Test agent
---
Content`);

      // Create symlink
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'test-agent.md');
      await fs.symlink(actualAgentPath, symlinkPath);

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should find the symlinked file
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].file).toContain('test-agent.md');
    });

    it('should NOT follow symlinks that escape project root', async () => {
      // Create agent file outside project root
      const outsideAgentPath = path.join(tempDir, '..', 'outside-agent.md');
      await fs.writeFile(outsideAgentPath, `---
name: outside-agent
description: Agent outside project
---
Content`);

      // Create symlink pointing outside
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'outside-agent.md');
      await fs.symlink(outsideAgentPath, symlinkPath);

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true, verbose: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should not include files that escape project root
      expect(results).toHaveLength(0);
    });

    it('should handle broken symlinks gracefully', async () => {
      // Create symlink to non-existent file
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'broken.md');
      const nonExistentPath = path.join(tempDir, 'does-not-exist.md');
      await fs.symlink(nonExistentPath, symlinkPath);

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      // Should not throw, just skip broken symlinks
      const results = await linter.lint(tempDir, options);
      expect(results).toHaveLength(0);
    });

    it('should handle directory symlinks', async () => {
      // Create actual agent files in directory
      const actualDir = path.join(tempDir, 'actual-agents');
      await fs.writeFile(path.join(actualDir, 'agent1.md'), `---
name: agent1
description: First agent
---
Content`);
      await fs.writeFile(path.join(actualDir, 'agent2.md'), `---
name: agent2
description: Second agent
---
Content`);

      // Create symlink to entire directory
      const symlinkDir = path.join(tempDir, '.claude', 'agents', 'linked');
      await fs.symlink(actualDir, symlinkDir);

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should find both agents through directory symlink
      expect(results).toHaveLength(2);
      const names = results.map(r => {
        const match = r.file.match(/agent\d\.md/);
        return match ? match[0] : null;
      }).sort();
      expect(names).toEqual(['agent1.md', 'agent2.md']);
    });
  });

  describe('CommandsLinter with symlinks', () => {
    it('should follow symlinks when enabled for commands', async () => {
      // Create actual command file (all fields are optional in command schema)
      const actualCommandPath = path.join(tempDir, 'actual-commands', 'test-command.md');
      await fs.writeFile(actualCommandPath, `---
description: Test command
allowed-tools: "Read, Write"
---
Content`);

      // Create symlink
      const symlinkPath = path.join(tempDir, '.claude', 'commands', 'test-command.md');
      await fs.symlink(actualCommandPath, symlinkPath);

      const linter = new CommandsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should find the symlinked command file
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
    });

    it('should validate symlinked commands with errors correctly', async () => {
      // Create command file with invalid model value
      const actualCommandPath = path.join(tempDir, 'actual-commands', 'invalid-command.md');
      await fs.writeFile(actualCommandPath, `---
description: Invalid command
model: invalid-model
---
Content`);

      // Create symlink
      const symlinkPath = path.join(tempDir, '.claude', 'commands', 'invalid-command.md');
      await fs.symlink(actualCommandPath, symlinkPath);

      const linter = new CommandsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should find and validate the symlinked file
      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false); // Invalid model value should make it invalid
      expect(results[0].errors.length).toBeGreaterThan(0); // Should have errors for invalid model
    });
  });

  describe('Security considerations', () => {
    it('should prevent symlink traversal attacks', async () => {
      // Try to create a symlink that goes up multiple directories
      const maliciousTarget = path.join('..', '..', '..', 'etc', 'passwd');
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'malicious.md');
      
      try {
        await fs.symlink(maliciousTarget, symlinkPath);
      } catch {
        // Symlink creation might fail on some systems
        return;
      }

      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      const results = await linter.lint(tempDir, options);
      
      // Should not include files outside project root
      expect(results).toHaveLength(0);
    });

    it('should handle circular symlinks safely', async () => {
      // Create circular symlink (A -> B -> A)
      const linkA = path.join(tempDir, '.claude', 'agents', 'linkA');
      const linkB = path.join(tempDir, '.claude', 'agents', 'linkB');
      
      await fs.mkdir(linkA, { recursive: true });
      await fs.symlink(linkA, linkB);
      // This would create a circular reference if followed indefinitely
      
      const linter = new AgentsLinter();
      const options: LintOptions = { followSymlinks: true };
      
      // Should not hang or crash
      const results = await linter.lint(tempDir, options);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('SDK normalizeOptions behavior', () => {
    it('should properly map followSymlinks option from SDK to internal options', async () => {
      // Test that the SDK properly normalizes options by checking the behavior
      // We'll use the existing tempDir which works with direct linters
      
      // Create actual agent file
      const actualAgentPath = path.join(tempDir, 'actual-agents', 'sdk-test.md');
      await fs.writeFile(actualAgentPath, `---
name: sdk-test
description: Test SDK option mapping
---
Content`);

      // Create symlink
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'sdk-test.md');
      await fs.symlink(actualAgentPath, symlinkPath);

      // Test direct linters work (baseline)
      const directLinter = new AgentsLinter();
      const directResults = await directLinter.lint(tempDir, { followSymlinks: true });
      expect(directResults).toHaveLength(1);

      // Now test that SDK internal option normalization includes followSymlinks
      const sdk = new CClint();
      
      // Use reflection to test the normalizeOptions method
      // @ts-ignore - accessing private method for testing
      const normalizedOptions = sdk.normalizeOptions({ followSymlinks: true });
      expect(normalizedOptions.followSymlinks).toBe(true);
      
      // @ts-ignore - accessing private method for testing  
      const normalizedOptionsDefault = sdk.normalizeOptions({});
      expect(normalizedOptionsDefault.followSymlinks).toBe(false);
      
      // @ts-ignore - accessing private method for testing
      const normalizedOptionsFalse = sdk.normalizeOptions({ followSymlinks: false });
      expect(normalizedOptionsFalse.followSymlinks).toBe(false);
    });

    it('should have all expected options in normalizeOptions output', async () => {
      const sdk = new CClint();
      
      // @ts-ignore - accessing private method for testing
      const normalized = sdk.normalizeOptions({
        quiet: true,
        verbose: false,
        failOn: 'warning',
        customSchemas: false,
        parallel: false,
        concurrency: 5,
        followSymlinks: true
      });
      
      // Verify all options are properly mapped
      expect(normalized.quiet).toBe(true);
      expect(normalized.verbose).toBe(false);
      expect(normalized.format).toBe('console');
      expect(normalized.failOn).toBe('warning');
      expect(normalized.customSchemas).toBe(false);
      expect(normalized.parallel).toBe(false);
      expect(normalized.concurrency).toBe(5);
      expect(normalized.followSymlinks).toBe(true);
    });
  });

  describe('SDK Methods with Mocked Security (Full Integration)', () => {
    beforeEach(() => {
      // Mock sanitizePath to bypass security for testing
      vi.spyOn(utils, 'sanitizePath').mockImplementation(async (inputPath: string) => {
        // Just return the realpath for test directories
        return await fs.realpath(inputPath);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle followSymlinks option in lintAgents() end-to-end', async () => {
      // Create actual agent file outside .claude directory
      const actualAgentPath = path.join(tempDir, 'actual-agents', 'integration-agent.md');
      await fs.writeFile(actualAgentPath, `---
name: integration-agent
description: Integration test agent for SDK
---
Full integration test content`);

      // Create symlink in .claude/agents
      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'integration-agent.md');
      await fs.symlink(actualAgentPath, symlinkPath);

      const sdk = new CClint();
      
      // Test without followSymlinks (should find 0 agents)
      const resultsWithoutSymlinks = await sdk.lintAgents(tempDir, { followSymlinks: false });
      expect(resultsWithoutSymlinks).toHaveLength(0);
      
      // Test with followSymlinks (should find 1 agent)
      const resultsWithSymlinks = await sdk.lintAgents(tempDir, { followSymlinks: true });
      expect(resultsWithSymlinks).toHaveLength(1);
      expect(resultsWithSymlinks[0].file).toBe(symlinkPath);
      expect(resultsWithSymlinks[0].valid).toBe(true);
    });

    it('should handle followSymlinks option in lintCommands() end-to-end', async () => {
      // Create actual command file outside .claude directory
      const actualCommandPath = path.join(tempDir, 'actual-commands', 'integration-command.md');
      await fs.writeFile(actualCommandPath, `---
description: Integration test command for SDK
allowed-tools: "Read, Write"
---

# Integration Test Command

Full integration test command content with arguments: $ARGUMENTS`);

      // Create symlink in .claude/commands
      const symlinkPath = path.join(tempDir, '.claude', 'commands', 'integration-command.md');
      await fs.symlink(actualCommandPath, symlinkPath);

      const sdk = new CClint();
      
      // Test without followSymlinks (should find 0 commands)
      const resultsWithoutSymlinks = await sdk.lintCommands(tempDir, { followSymlinks: false });
      expect(resultsWithoutSymlinks).toHaveLength(0);
      
      // Test with followSymlinks (should find 1 command)
      const resultsWithSymlinks = await sdk.lintCommands(tempDir, { followSymlinks: true });
      expect(resultsWithSymlinks).toHaveLength(1);
      expect(resultsWithSymlinks[0].file).toBe(symlinkPath);
      expect(resultsWithSymlinks[0].valid).toBe(true);
    });

    it('should have consistent behavior between lintProject and specialized methods', async () => {
      // Create multiple files with symlinks
      const agentPath = path.join(tempDir, 'actual-agents', 'consistency-agent.md');
      await fs.writeFile(agentPath, `---
name: consistency-agent
description: Consistency test agent
tools: ["Read", "Write"]
---
Agent content`);

      const commandPath = path.join(tempDir, 'actual-commands', 'consistency-command.md');
      await fs.writeFile(commandPath, `---
description: Consistency test command
allowed-tools: "Read, Write"
---

# Command`);

      // Create symlinks
      const agentSymlink = path.join(tempDir, '.claude', 'agents', 'consistency-agent.md');
      const commandSymlink = path.join(tempDir, '.claude', 'commands', 'consistency-command.md');
      await fs.symlink(agentPath, agentSymlink);
      await fs.symlink(commandPath, commandSymlink);

      const sdk = new CClint();
      const options = { followSymlinks: true };
      
      // Get results from all methods
      const projectResult = await sdk.lintProject(tempDir, options);
      const agentResults = await sdk.lintAgents(tempDir, options);
      const commandResults = await sdk.lintCommands(tempDir, options);
      
      // Verify all methods find files when followSymlinks is enabled
      expect(agentResults.length).toBe(1);
      expect(commandResults.length).toBe(1);
      expect(projectResult.totalFiles).toBeGreaterThanOrEqual(2);
      
      // Verify the files found are the symlinks
      expect(agentResults[0].file).toBe(agentSymlink);
      expect(commandResults[0].file).toBe(commandSymlink);
      
      // Verify all are valid
      expect(agentResults[0].valid).toBe(true);
      expect(commandResults[0].valid).toBe(true);
    });

    it('should properly handle both followSymlinks: true and false states', async () => {
      // Create file with symlink
      const actualPath = path.join(tempDir, 'actual-agents', 'toggle-test.md');
      await fs.writeFile(actualPath, `---
name: toggle-test
description: Test followSymlinks toggle behavior
---
Content`);

      const symlinkPath = path.join(tempDir, '.claude', 'agents', 'toggle-test.md');
      await fs.symlink(actualPath, symlinkPath);

      const sdk = new CClint();
      
      // Test false state
      const resultsFalse = await sdk.lintAgents(tempDir, { followSymlinks: false });
      expect(resultsFalse).toHaveLength(0);
      
      // Test true state
      const resultsTrue = await sdk.lintAgents(tempDir, { followSymlinks: true });
      expect(resultsTrue).toHaveLength(1);
      
      // Test default state (should be false)
      const resultsDefault = await sdk.lintAgents(tempDir, {});
      expect(resultsDefault).toHaveLength(0);
    });
  });
});