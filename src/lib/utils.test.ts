import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { calculateSummary, shouldFailBuild, getExitCode, formatDuration, pluralize, sanitizePath, isPathSafe, PathSecurityError } from './utils.js';
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
          missingFields: [],
        },
        {
          file: 'test2.md',
          valid: false,
          errors: ['error1'],
          warnings: ['warning1'],
          suggestions: [],
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

  describe('Path Security Functions', () => {
    let tempDir: string;
    let testDir: string;
    let outsideDir: string;

    beforeEach(async () => {
      // Create temporary directory structure for testing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-security-test-'));
      testDir = path.join(tempDir, 'test-project');
      // outsideDir should be completely outside tempDir for proper testing
      outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-outside-'));
      
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up temp directories
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.rm(outsideDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('sanitizePath', () => {
      it('should accept valid paths within the allowed directory', async () => {
        const validPath = path.join(testDir, 'subdirectory');
        await fs.mkdir(validPath, { recursive: true });
        
        const result = await sanitizePath(validPath, tempDir);
        expect(result).toBe(await fs.realpath(validPath));
      });

      it('should accept the allowed directory itself', async () => {
        const result = await sanitizePath(testDir, tempDir);
        expect(result).toBe(await fs.realpath(testDir));
      });

      it('should reject empty or invalid input', async () => {
        await expect(sanitizePath('', tempDir)).rejects.toThrow(PathSecurityError);
        await expect(sanitizePath('   ', tempDir)).rejects.toThrow(PathSecurityError);
        await expect(sanitizePath(null as unknown as string, tempDir)).rejects.toThrow(PathSecurityError);
        await expect(sanitizePath(undefined as unknown as string, tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should reject paths with null bytes', async () => {
        await expect(sanitizePath('test\0dir', tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should reject path traversal attempts with ../', async () => {
        await expect(sanitizePath('../../../etc/passwd', tempDir)).rejects.toThrow(PathSecurityError);
        await expect(sanitizePath(path.join(testDir, '../outside'), tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should reject absolute paths outside allowed directory', async () => {
        await expect(sanitizePath('/etc/passwd', tempDir)).rejects.toThrow(PathSecurityError);
        await expect(sanitizePath(outsideDir, tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should reject non-existent paths', async () => {
        const nonExistentPath = path.join(testDir, 'does-not-exist');
        await expect(sanitizePath(nonExistentPath, tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should reject file paths (only directories allowed)', async () => {
        const filePath = path.join(testDir, 'test.txt');
        await fs.writeFile(filePath, 'test content');
        
        await expect(sanitizePath(filePath, tempDir)).rejects.toThrow(PathSecurityError);
      });

      it('should handle relative paths correctly', async () => {
        const subDir = path.join(testDir, 'subdir');
        await fs.mkdir(subDir, { recursive: true });
        
        // Test relative path resolution
        const result = await sanitizePath('./subdir', testDir);
        expect(result).toBe(await fs.realpath(subDir));
      });

      it('should detect symbolic link escapes', async () => {
        const linkDir = path.join(testDir, 'link');
        
        try {
          // Create symbolic link pointing outside allowed directory
          await fs.symlink(outsideDir, linkDir);
          
          await expect(sanitizePath(linkDir, tempDir)).rejects.toThrow(PathSecurityError);
        } catch (error) {
          // Skip this test on systems that don't support symlinks
          if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'ENOTSUP') {
            console.log('Skipping symlink test (not supported on this system)');
            return;
          }
          throw error;
        }
      });

      it('should allow safe symbolic links within allowed directory', async () => {
        const targetDir = path.join(testDir, 'target');
        const linkDir = path.join(testDir, 'link');
        
        try {
          await fs.mkdir(targetDir);
          await fs.symlink(targetDir, linkDir);
          
          const result = await sanitizePath(linkDir, tempDir);
          expect(result).toBe(await fs.realpath(targetDir));
        } catch (error) {
          // Skip this test on systems that don't support symlinks
          if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'ENOTSUP') {
            console.log('Skipping safe symlink test (not supported on this system)');
            return;
          }
          throw error;
        }
      });

      it('should use current working directory as default base path', async () => {
        // Create a subdirectory in the current working directory
        const cwd = process.cwd();
        const subDir = path.join(cwd, 'test-subdir-' + Date.now());
        await fs.mkdir(subDir);
        
        try {
          const result = await sanitizePath(subDir);
          expect(result).toBe(await fs.realpath(subDir));
        } finally {
          // Clean up
          await fs.rmdir(subDir);
        }
      });
    });

    describe('isPathSafe', () => {
      it('should return true for safe paths', () => {
        expect(isPathSafe('subdir', testDir)).toBe(true);
        expect(isPathSafe(path.join(testDir, 'subdir'), tempDir)).toBe(true);
        expect(isPathSafe(testDir, tempDir)).toBe(true);
      });

      it('should return false for unsafe paths', () => {
        expect(isPathSafe('../../../etc/passwd', testDir)).toBe(false);
        expect(isPathSafe('/etc/passwd', testDir)).toBe(false);
        expect(isPathSafe('', testDir)).toBe(false);
        expect(isPathSafe('   ', testDir)).toBe(false);
        expect(isPathSafe(null as unknown as string, testDir)).toBe(false);
        expect(isPathSafe(undefined as unknown as string, testDir)).toBe(false);
        expect(isPathSafe('test\0dir', testDir)).toBe(false);
      });

      it('should handle edge cases gracefully', () => {
        expect(isPathSafe(123 as unknown as string, testDir)).toBe(false);
        expect(isPathSafe({} as unknown as string, testDir)).toBe(false);
        expect(isPathSafe([] as unknown as string, testDir)).toBe(false);
      });

      it('should use current working directory as default base path', () => {
        const cwd = process.cwd();
        expect(isPathSafe('./src', cwd)).toBe(true);
        expect(isPathSafe('../../../etc', cwd)).toBe(false);
      });
    });

    describe('PathSecurityError', () => {
      it('should create error with proper properties', () => {
        const error = new PathSecurityError('Test message', '/test/path');
        expect(error.message).toBe('Test message');
        expect(error.path).toBe('/test/path');
        expect(error.name).toBe('PathSecurityError');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});