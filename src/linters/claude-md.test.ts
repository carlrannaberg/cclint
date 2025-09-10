import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ClaudeMdLinter } from './claude-md.js';
import type { LintOptions } from '../types/index.js';

describe('ClaudeMdLinter', () => {
  const testDir = '/tmp/cclint-test-claude-md';
  const linter = new ClaudeMdLinter();
  
  const defaultOptions: LintOptions = {
    quiet: false,
    verbose: false,
    format: 'console',
    failOn: 'error',
    customSchemas: true,
    parallel: false,
    concurrency: 10,
    followSymlinks: false,
  };

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Content Length Validation', () => {
    it('should warn when content is too short', async () => {
      const shortContent = '# My Project\n\nShort description.';
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), shortContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].warnings).toContain('Document is quite short - consider adding more guidance for AI assistants');
    });

    it('should warn when content exceeds 40k characters', async () => {
      // Create content over 40k characters
      const longContent = '# My Project\n\n' + 'x'.repeat(40001);
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), longContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      const warnings = results[0].warnings;
      const sizeWarning = warnings.find(w => w.includes('exceeds 40k character recommendation'));
      expect(sizeWarning).toBeDefined();
      expect(sizeWarning).toContain('40,015 characters'); // 15 chars header + 40001 x's
      expect(sizeWarning).toContain('Consider splitting into multiple files');
    });

    it('should not warn for content within acceptable range', async () => {
      // Create content that's not too short or too long
      const normalContent = '# My Project\n\n' + 'x'.repeat(5000);
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), normalContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      const warnings = results[0].warnings;
      const lengthWarnings = warnings.filter(w => 
        w.includes('quite short') || w.includes('exceeds 40k')
      );
      expect(lengthWarnings).toHaveLength(0);
    });

    it('should handle exactly 40k characters without warning', async () => {
      // Create content exactly 40k characters
      const exactContent = '# My Project\n\n' + 'x'.repeat(40000 - 15); // 15 chars for header
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), exactContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      const warnings = results[0].warnings;
      const sizeWarning = warnings.find(w => w.includes('exceeds 40k character recommendation'));
      expect(sizeWarning).toBeUndefined();
    });

    it('should properly format large numbers with commas', async () => {
      // Create content with specific size to test number formatting
      const header = '# My Project\n\n';
      const content = header + 'x'.repeat(123456 - header.length); // Will be exactly 123,456 characters
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), content);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      const warnings = results[0].warnings;
      const sizeWarning = warnings.find(w => w.includes('exceeds 40k character recommendation'));
      expect(sizeWarning).toBeDefined();
      expect(sizeWarning).toContain('123,456 characters');
    });
  });

  describe('Basic Structure Validation', () => {
    it('should detect missing main title', async () => {
      const noTitleContent = 'Just some content without a title';
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), noTitleContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].errors).toContain('Missing main title (# heading)');
    });

    it('should detect missing description', async () => {
      const noDescContent = '# My Project\n## Section 1\nContent';
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), noDescContent);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      const warnings = results[0].warnings;
      const descWarning = warnings.find(w => w.includes('no introductory text'));
      expect(descWarning).toBeDefined();
    });

    it('should suggest creating CLAUDE.md when missing', async () => {
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].suggestions).toContain(
        'No CLAUDE.md or AGENTS.md found - consider creating one to document the project for AI assistants'
      );
    });

    it('should also accept AGENTS.md as valid file', async () => {
      const content = '# My Project\n\nDescription\n\n## Build & Commands\n\nContent';
      await fs.writeFile(path.join(testDir, 'AGENTS.md'), content);
      
      const results = await linter.lint(testDir, defaultOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('AGENTS.md');
      // Should not have the "missing file" suggestion
      const suggestions = results[0].suggestions;
      const missingSuggestion = suggestions.find(s => s.includes('No CLAUDE.md or AGENTS.md found'));
      expect(missingSuggestion).toBeUndefined();
    });
  });
});