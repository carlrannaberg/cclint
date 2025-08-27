import { describe, it, expect } from 'vitest';
import { hasFrontmatter, validateToolPattern } from './base.js';

describe('base linter utilities', () => {
  describe('hasFrontmatter', () => {
    it('should detect frontmatter correctly', () => {
      const withFrontmatter = '---\ntitle: Test\n---\nContent';
      const withoutFrontmatter = 'Just some content';
      const emptyContent = '';

      expect(hasFrontmatter(withFrontmatter)).toBe(true);
      expect(hasFrontmatter(withoutFrontmatter)).toBe(false);
      expect(hasFrontmatter(emptyContent)).toBe(false);
    });
  });

  describe('validateToolPattern', () => {
    it('should validate tool patterns correctly', () => {
      expect(validateToolPattern('Bash')).toEqual([]);
      expect(validateToolPattern('Bash(git:*)')).toEqual([]);
      expect(validateToolPattern('Bash(git')).toEqual(['Unmatched parentheses in tool specification: Bash(git']);
      expect(validateToolPattern('Bash((git')).toEqual(['Unmatched parentheses in tool specification: Bash((git']);
    });
  });
});