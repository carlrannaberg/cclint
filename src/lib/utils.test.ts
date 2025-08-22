import { describe, it, expect } from 'vitest';
import { calculateSummary, shouldFailBuild, getExitCode, formatDuration, pluralize } from './utils.js';
import type { LintResult } from '../types/index.js';

describe('utils', () => {
  describe('calculateSummary', () => {
    it('should calculate summary correctly for valid results', () => {
      const results: LintResult[] = [
        {
          file: 'test1.md',
          valid: true,
          errors: [],
          warnings: [],
          suggestions: ['suggestion1'],
          unusedFields: [],
          missingFields: [],
        },
        {
          file: 'test2.md',
          valid: false,
          errors: ['error1'],
          warnings: ['warning1'],
          suggestions: [],
          unusedFields: ['field1'],
          missingFields: [],
        },
      ];

      const startTime = Date.now() - 100;
      const summary = calculateSummary(results, startTime);

      expect(summary.totalFiles).toBe(2);
      expect(summary.validFiles).toBe(1);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.totalSuggestions).toBe(1);
      expect(summary.totalUnusedFields).toBe(1);
      expect(summary.duration).toBeGreaterThan(0);
      expect(summary.results).toBe(results);
    });

    it('should handle empty results', () => {
      const results: LintResult[] = [];
      const startTime = Date.now();
      const summary = calculateSummary(results, startTime);

      expect(summary.totalFiles).toBe(0);
      expect(summary.validFiles).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.totalWarnings).toBe(0);
      expect(summary.totalSuggestions).toBe(0);
      expect(summary.totalUnusedFields).toBe(0);
    });
  });

  describe('shouldFailBuild', () => {
    const mockSummary = {
      totalFiles: 1,
      validFiles: 1,
      totalErrors: 1,
      totalWarnings: 1,
      totalSuggestions: 1,
      totalUnusedFields: 0,
      duration: 100,
      results: [],
    };

    it('should fail on errors for error level', () => {
      expect(shouldFailBuild(mockSummary, 'error')).toBe(true);
    });

    it('should fail on warnings for warning level', () => {
      expect(shouldFailBuild(mockSummary, 'warning')).toBe(true);
    });

    it('should fail on suggestions for suggestion level', () => {
      expect(shouldFailBuild(mockSummary, 'suggestion')).toBe(true);
    });

    it('should not fail for clean summary', () => {
      const cleanSummary = { ...mockSummary, totalErrors: 0, totalWarnings: 0, totalSuggestions: 0 };
      expect(shouldFailBuild(cleanSummary, 'error')).toBe(false);
      expect(shouldFailBuild(cleanSummary, 'warning')).toBe(false);
      expect(shouldFailBuild(cleanSummary, 'suggestion')).toBe(false);
    });
  });

  describe('getExitCode', () => {
    it('should return 1 for failing builds', () => {
      const summary = {
        totalFiles: 1,
        validFiles: 0,
        totalErrors: 1,
        totalWarnings: 0,
        totalSuggestions: 0,
        totalUnusedFields: 0,
        duration: 100,
        results: [],
      };
      expect(getExitCode(summary, 'error')).toBe(1);
    });

    it('should return 0 for passing builds', () => {
      const summary = {
        totalFiles: 1,
        validFiles: 1,
        totalErrors: 0,
        totalWarnings: 0,
        totalSuggestions: 0,
        totalUnusedFields: 0,
        duration: 100,
        results: [],
      };
      expect(getExitCode(summary, 'error')).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(2000)).toBe('2s');
    });
  });

  describe('pluralize', () => {
    it('should handle singular and plural correctly', () => {
      expect(pluralize(1, 'file')).toBe('1 file');
      expect(pluralize(0, 'file')).toBe('0 files');
      expect(pluralize(2, 'file')).toBe('2 files');
      expect(pluralize(1, 'child', 'children')).toBe('1 child');
      expect(pluralize(2, 'child', 'children')).toBe('2 children');
    });
  });
});