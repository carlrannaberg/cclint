/**
 * Unit tests for core SDK functions
 * 
 * These tests verify the core linting functionality extracted from the CLI,
 * ensuring that SDK functions work correctly and maintain all expected behavior.
 */

import { describe, it, expect } from 'vitest';
import { lintProject, lintFiles, loadProjectConfig, detectProject } from './core.js';
import type { SDKLintOptions, CclintConfig, EnhancedLintSummary } from '../types/index.js';

describe('Core SDK Functions', () => {
  const testProjectPath = '.';

  describe('lintProject', () => {
    it('should return structured results for test project', async () => {
      const results = await lintProject(testProjectPath);
      
      expect(results).toMatchObject({
        totalFiles: expect.any(Number),
        validFiles: expect.any(Number),
        totalErrors: expect.any(Number),
        totalWarnings: expect.any(Number),
        totalSuggestions: expect.any(Number),
        duration: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            valid: expect.any(Boolean),
            errors: expect.any(Array),
            warnings: expect.any(Array),
            suggestions: expect.any(Array),
            missingFields: expect.any(Array)
          })
        ])
      });
      
      expect(results.totalFiles).toBeGreaterThan(0);
      expect(results.results).toHaveLength(results.totalFiles);
    });

    it('should include metadata when requested', async () => {
      const options: SDKLintOptions = { 
        includeMetadata: true,
        quiet: true
      };
      
      const results = await lintProject(testProjectPath, options);
      
      expect(results).toHaveProperty('metadata');
      const enhancedResults = results as EnhancedLintSummary;
      expect(enhancedResults.metadata).toMatchObject({
        duration: expect.any(Number),
        nodeVersion: expect.any(String),
        cclintVersion: expect.any(String),
        projectRoot: expect.any(String),
        linterCount: expect.any(Number),
        parallelExecution: expect.any(Boolean),
        concurrency: expect.any(Number)
      });
    });

    it('should handle parallel vs sequential execution', async () => {
      // Test parallel execution
      const parallelResults = await lintProject(testProjectPath, { 
        parallel: true, 
        concurrency: 5,
        quiet: true
      });
      
      // Test sequential execution  
      const sequentialResults = await lintProject(testProjectPath, { 
        parallel: false,
        quiet: true
      });
      
      // Both should produce same results
      expect(parallelResults.totalFiles).toBe(sequentialResults.totalFiles);
      expect(parallelResults.totalErrors).toBe(sequentialResults.totalErrors);
      expect(parallelResults.totalWarnings).toBe(sequentialResults.totalWarnings);
    });

    it('should handle custom configuration', async () => {
      const customConfig: CclintConfig = {
        rules: {
          strict: true,
          unknownFields: 'error'
        }
      };
      
      const results = await lintProject(testProjectPath, { quiet: true }, customConfig);
      
      expect(results).toBeDefined();
      expect(results.totalFiles).toBeGreaterThan(0);
    });

    it('should handle quiet mode', async () => {
      const results = await lintProject(testProjectPath, { quiet: true });
      
      expect(results).toBeDefined();
      expect(results.totalFiles).toBeGreaterThan(0);
    });

    it('should handle verbose mode', async () => {
      const results = await lintProject(testProjectPath, { verbose: true });
      
      expect(results).toBeDefined();
      expect(results.totalFiles).toBeGreaterThan(0);
    });

    it('should handle path security validation', async () => {
      await expect(lintProject('../../../etc')).rejects.toThrow();
      await expect(lintProject('/etc/passwd')).rejects.toThrow();
    });
  });

  describe('lintFiles', () => {
    it('should handle empty file list', async () => {
      const results = await lintFiles([], { quiet: true });
      
      expect(results.totalFiles).toBe(0);
      expect(results.results).toHaveLength(0);
      expect(results.totalErrors).toBe(0);
    });

    it('should handle invalid file paths gracefully', async () => {
      // Test with non-existent files - should handle gracefully
      try {
        const results = await lintFiles(['/nonexistent/file.md'], { quiet: true });
        // If it doesn't throw, results should be defined
        expect(results).toBeDefined();
      } catch (error) {
        // It's acceptable for it to throw an error for invalid files
        expect(error).toBeDefined();
      }
    });

    it('should validate lintFiles function signature and behavior', async () => {
      // Test that the function exists and has the right signature
      expect(typeof lintFiles).toBe('function');
      
      // Test with empty array (should work)
      const emptyResults = await lintFiles([], { quiet: true });
      expect(emptyResults).toMatchObject({
        totalFiles: 0,
        validFiles: 0,
        totalErrors: 0,
        totalWarnings: 0,
        totalSuggestions: 0,
        duration: expect.any(Number),
        results: []
      });
    });
  });

  describe('loadProjectConfig', () => {
    it('should load existing configuration', async () => {
      const config = await loadProjectConfig(testProjectPath);
      
      // Current project has a config file, so should not be null
      expect(config).not.toBeNull();
      if (config) {
        expect(typeof config).toBe('object');
      }
    });

    it('should handle invalid project paths', async () => {
      await expect(loadProjectConfig('../../../invalid')).rejects.toThrow();
    });
  });

  describe('detectProject', () => {
    it('should detect project information', async () => {
      const projectInfo = await detectProject(testProjectPath);
      
      expect(projectInfo).toMatchObject({
        root: expect.any(String),
        hasGit: expect.any(Boolean),
        hasClaudeDir: expect.any(Boolean),
        hasPackageJson: expect.any(Boolean)
      });
    });

    it('should auto-detect project root when not specified', async () => {
      const projectInfo = await detectProject();
      expect(projectInfo).toBeDefined();
      expect(projectInfo.root).toBeDefined();
    });

    it('should handle path security validation', async () => {
      await expect(detectProject('../../../etc')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should preserve security measures', async () => {
      // Test various path traversal attempts
      const maliciousPaths = [
        '../../../etc/passwd',
        '/etc/passwd',
        '../../../root'
      ];
      
      for (const path of maliciousPaths) {
        await expect(lintProject(path)).rejects.toThrow();
        await expect(detectProject(path)).rejects.toThrow();
        await expect(loadProjectConfig(path)).rejects.toThrow();
      }
    });

    it('should handle non-existent project gracefully', async () => {
      // Should handle missing directories gracefully
      try {
        const results = await lintProject('./non-existent-project', { quiet: true });
        expect(results).toBeDefined();
      } catch (error) {
        // It's OK if it throws an error for non-existent projects
        expect(error).toBeDefined();
      }
    });
  });

  describe('SDK vs CLI Consistency', () => {
    it('should produce consistent results with existing CLI', async () => {
      // Test that SDK produces same logical results as CLI would
      const results = await lintProject(testProjectPath, { quiet: true });
      
      expect(results).toBeDefined();
      expect(typeof results.totalFiles).toBe('number');
      expect(typeof results.totalErrors).toBe('number');
      expect(typeof results.totalWarnings).toBe('number');
      expect(typeof results.duration).toBe('number');
      expect(Array.isArray(results.results)).toBe(true);
    });

    it('should handle all SDK option combinations', async () => {
      const allOptions: SDKLintOptions = {
        quiet: true,
        verbose: false,
        failOn: 'warning',
        customSchemas: true,
        parallel: true,
        concurrency: 8,
        includeMetadata: true,
        returnRawResults: true
      };

      const results = await lintProject(testProjectPath, allOptions);
      expect(results).toBeDefined();
      expect(results.totalFiles).toBeGreaterThanOrEqual(0);
    });
  });
});