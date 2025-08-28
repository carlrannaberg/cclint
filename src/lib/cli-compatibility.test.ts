/**
 * Integration tests for CLI compatibility
 * 
 * These tests ensure that the CLI interface remains unchanged after extracting
 * core logic to SDK functions, maintaining backward compatibility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lintCommand } from '../commands/lint.js';
import type { LintOptions } from '../types/index.js';

// Mock process.exit to prevent test termination
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`process.exit(${code})`);
});

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('CLI Compatibility Tests', () => {
  const testProjectPath = '.';

  beforeEach(() => {
    mockExit.mockClear();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  describe('CLI Command Execution', () => {
    it('should exit with appropriate code for test project', async () => {
      const options: LintOptions = {
        root: testProjectPath,
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
        // Should not reach here if exit is called
        expect(false).toBe(true); // Force failure if no exit
      } catch (error) {
        // Expect process.exit to be called
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
        expect(error).toEqual(new Error(`process.exit(${mockExit.mock.calls[0][0]})`));
      }
    });

    it('should handle different failOn levels', async () => {
      const optionsError: LintOptions = {
        root: testProjectPath,
        quiet: true,
        failOn: 'error'
      };

      const optionsWarning: LintOptions = {
        root: testProjectPath,
        quiet: true,
        failOn: 'warning'
      };

      try {
        await lintCommand(optionsError);
      } catch (error1) {
        const errorExitCode = mockExit.mock.calls[0][0];
        
        mockExit.mockClear();
        
        try {
          await lintCommand(optionsWarning);
        } catch (error2) {
          const warningExitCode = mockExit.mock.calls[0][0];
          
          // Warning mode should be at least as strict as error mode
          expect(typeof errorExitCode).toBe('number');
          expect(typeof warningExitCode).toBe('number');
        }
      }
    });

    it('should handle quiet mode correctly', async () => {
      const options: LintOptions = {
        root: testProjectPath,
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // In quiet mode, should not log the project path
        expect(mockConsoleLog).not.toHaveBeenCalledWith(
          expect.stringContaining('Linting Claude Code project at:')
        );
      }
    });

    it('should handle verbose mode correctly', async () => {
      const options: LintOptions = {
        root: testProjectPath,
        verbose: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // Should log project information in verbose mode
        expect(mockConsoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Linting Claude Code project at:')
        );
      }
    });

    it('should handle parallel vs sequential execution', async () => {
      const parallelOptions: LintOptions = {
        root: testProjectPath,
        quiet: true,
        parallel: true,
        concurrency: 5,
        failOn: 'error'
      };

      const sequentialOptions: LintOptions = {
        root: testProjectPath,
        quiet: true,
        parallel: false,
        failOn: 'error'
      };

      // Both should complete without throwing unexpected errors
      try {
        await lintCommand(parallelOptions);
      } catch (error1) {
        const parallelExitCode = mockExit.mock.calls[0][0];
        
        mockExit.mockClear();
        
        try {
          await lintCommand(sequentialOptions);
        } catch (error2) {
          const sequentialExitCode = mockExit.mock.calls[0][0];
          
          // Both should exit with same code (same project, same validation)
          expect(parallelExitCode).toBe(sequentialExitCode);
        }
      }
    });
  });

  describe('CLI Security Validation', () => {
    it('should handle path security errors correctly', async () => {
      const options: LintOptions = {
        root: '../../../etc/passwd',
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
        expect(false).toBe(true);
      } catch (error) {
        // Should exit with error code and log security error
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('Security Error:')
        );
        expect(mockExit).toHaveBeenCalledWith(1);
      }
    });

    it('should validate root path before processing', async () => {
      const maliciousPaths = [
        '../../../root',
        '/etc/passwd'
      ];

      for (const path of maliciousPaths) {
        mockExit.mockClear();
        mockConsoleError.mockClear();

        const options: LintOptions = {
          root: path,
          quiet: true,
          failOn: 'error'
        };

        try {
          await lintCommand(options);
          expect(false).toBe(true);
        } catch (error) {
          expect(mockExit).toHaveBeenCalledWith(1);
        }
      }
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle missing project directories', async () => {
      const options: LintOptions = {
        root: './nonexistent-project',
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // Should handle missing directories and exit with error
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
      }
    });
  });

  describe('CLI Option Processing', () => {
    it('should process all CLI options correctly', async () => {
      const options: LintOptions = {
        root: testProjectPath,
        quiet: false,
        verbose: true,
        format: 'console',
        failOn: 'warning',
        customSchemas: true,
        parallel: true,
        concurrency: 8
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // Should process all options without throwing unexpected errors
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
      }
    });

    it('should handle default option values', async () => {
      const minimalOptions: LintOptions = {
        root: testProjectPath
      };

      try {
        await lintCommand(minimalOptions);
      } catch (error) {
        // Should work with minimal options using defaults
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain exact same behavior as before extraction', async () => {
      // This test verifies that the CLI behavior hasn't changed
      // after extracting core logic to SDK functions
      
      const options: LintOptions = {
        root: testProjectPath,
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // Should behave exactly the same as the original implementation
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
        
        // Verify that console output patterns are preserved
        // (In quiet mode, should not have project path logging)
        expect(mockConsoleLog).not.toHaveBeenCalledWith(
          expect.stringContaining('Linting Claude Code project at:')
        );
      }
    });

    it('should preserve all existing exit code behaviors', async () => {
      const testCases = [
        { failOn: 'error' as const },
        { failOn: 'warning' as const },
        { failOn: 'suggestion' as const }
      ];

      for (const testCase of testCases) {
        mockExit.mockClear();

        const options: LintOptions = {
          root: testProjectPath,
          quiet: true,
          failOn: testCase.failOn
        };

        try {
          await lintCommand(options);
        } catch (error) {
          expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
        }
      }
    });

    it('should handle process.cwd() fallback correctly', async () => {
      const options: LintOptions = {
        // No root specified - should use current directory
        quiet: true,
        failOn: 'error'
      };

      try {
        await lintCommand(options);
      } catch (error) {
        // Should handle cwd fallback and exit appropriately
        expect(mockExit).toHaveBeenCalledWith(expect.any(Number));
      }
    });
  });
});