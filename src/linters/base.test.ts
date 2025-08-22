import { describe, it, expect } from 'vitest';
import { hasFrontmatter, validateToolPattern, validateColor } from './base.js';

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

  describe('validateColor', () => {
    const cssColors = new Set(['red', 'blue', 'green', 'black', 'white']);

    it('should validate hex colors correctly', () => {
      expect(validateColor('#FF0000', cssColors)).toBe(true);
      expect(validateColor('#ff0000', cssColors)).toBe(true);
      expect(validateColor('#FF0000AA', cssColors)).toBe(true);
      expect(validateColor('#GG0000', cssColors)).toBe(false);
      expect(validateColor('#FF000', cssColors)).toBe(false);
    });

    it('should validate CSS named colors correctly', () => {
      expect(validateColor('red', cssColors)).toBe(true);
      expect(validateColor('RED', cssColors)).toBe(true);
      expect(validateColor('purple', cssColors)).toBe(false);
      expect(validateColor('invalid-color', cssColors)).toBe(false);
    });
  });
});