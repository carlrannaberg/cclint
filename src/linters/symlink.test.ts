import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AgentsLinter } from './agents.js';
import { CommandsLinter } from './commands.js';
import { CClint } from '../lib/sdk.js';
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
});