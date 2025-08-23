import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, validateConfig, mergeWithDefaults, findConfigFile } from './config.js';
import type { CclintConfig } from '../types/index.js';

describe('Configuration Loading System', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cclint-config-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('path security', () => {
    it('should reject path traversal attacks in project root', async () => {
      await expect(loadConfig('../../../etc')).rejects.toThrow('Invalid project root path');
    });

    it('should reject absolute paths outside allowed directory', async () => {
      await expect(loadConfig('/etc/passwd')).rejects.toThrow('Invalid project root path');
    });

    it('should accept valid project paths', async () => {
      // Should not throw for valid path
      const result = await loadConfig(tempDir);
      expect(result).toBeNull(); // No config file exists, but path is valid
    });
  });

  describe('JSON configuration loading', () => {
    it('should load valid JSON configuration', async () => {
      const config: CclintConfig = {
        rules: {
          unknownFields: 'error',
          strict: true
        },
        agentSchema: {
          extend: {
            customField: { type: 'string' }
          }
        }
      };

      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await loadConfig(tempDir);
      expect(result).toEqual(config);
    });

    it('should handle malformed JSON gracefully', async () => {
      const invalidJson = `{
        "rules": {
          "unknownFields": "error",
        }
      }`;

      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, invalidJson);

      // Should not throw, but return null due to parsing error
      const result = await loadConfig(tempDir);
      expect(result).toBeNull();
    });

    it('should reject non-object JSON', async () => {
      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, '"not an object"');

      const result = await loadConfig(tempDir);
      expect(result).toBeNull();
    });
  });

  describe('JavaScript configuration loading security', () => {
    it('should load JavaScript configuration files', async () => {
      const jsConfig = `
        module.exports = {
          rules: {
            unknownFields: 'warning'
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, jsConfig);

      const result = await loadConfig(tempDir);
      
      expect(result).toEqual({
        rules: {
          unknownFields: 'warning'
        }
      });
    });

    it('should reject TypeScript configuration files', async () => {
      const tsConfig = `
        export default {
          rules: {
            unknownFields: 'error'
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.ts');
      await fs.writeFile(configPath, tsConfig);

      // Note: TypeScript files are no longer in the CONFIG_FILES list
      const result = await loadConfig(tempDir);
      expect(result).toBeNull();
    });

    it('should accept configurations with __proto__ (no longer blocked)', async () => {
      const configWithProto = `
        module.exports = {
          rules: {
            unknownFields: 'warning'
          },
          __proto__: {
            dangerous: true
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, configWithProto);

      const result = await loadConfig(tempDir);
      expect(result).toEqual({
        rules: {
          unknownFields: 'warning'
        }
      }); // __proto__ doesn't create an own property, so it won't show up
    });

    it('should validate configuration safety - reject unexpected functions', async () => {
      const functionConfig = `
        module.exports = {
          rules: {
            unknownFields: 'warning'
          },
          maliciousFunction: function() {
            return 'dangerous';
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(functionConfig, functionConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeNull(); // Should fail safety validation
    });

    it('should allow customValidation functions in proper contexts', async () => {
      const validConfig = `
        module.exports = {
          agentSchema: {
            customValidation: function(data) {
              return [];
            }
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, validConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeTruthy();
      expect(result?.agentSchema?.customValidation).toBeTypeOf('function');
    });

    it('should handle function exports with timeout', async () => {
      const functionConfig = `
        module.exports = function() {
          return {
            rules: {
              unknownFields: 'error'
            }
          };
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, functionConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeTruthy();
      expect(result?.rules?.unknownFields).toBe('error');
    });

    it('should timeout hanging function exports', async () => {
      const hangingConfig = `
        module.exports = function() {
          // This would hang indefinitely (using a promise that never resolves)
          return new Promise(() => {
            // Never resolves or rejects
          });
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, hangingConfig);

      // This should complete within reasonable time due to timeout
      const startTime = Date.now();
      const result = await loadConfig(tempDir);
      const duration = Date.now() - startTime;
      
      expect(result).toBeNull();
      expect(duration).toBeLessThan(10000); // Should timeout before 10 seconds
    }, 10000);
  });

  describe('configuration file precedence', () => {
    it('should prioritize JSON over JavaScript files', async () => {
      const jsonConfig = {
        rules: { unknownFields: 'error' }
      };
      const jsConfig = `
        module.exports = {
          rules: { unknownFields: 'warning' }
        };
      `;

      await fs.writeFile(path.join(tempDir, '.cclintrc.json'), JSON.stringify(jsonConfig));
      await fs.writeFile(path.join(tempDir, 'cclint.config.js'), jsConfig);

      const result = await loadConfig(tempDir);
      expect(result?.rules?.unknownFields).toBe('error'); // Should use JSON config
    });

    it('should follow correct precedence order', async () => {
      // Create multiple config files
      await fs.writeFile(path.join(tempDir, 'cclint.config.js'), `
        module.exports = { rules: { unknownFields: 'js' } };
      `);
      await fs.writeFile(path.join(tempDir, '.cclintrc.json'), JSON.stringify({
        rules: { unknownFields: 'rc-json' }
      }));

      const result = await loadConfig(tempDir);
      expect(result?.rules?.unknownFields).toBe('rc-json'); // .cclintrc.json should win
    });
  });

  describe('configuration caching', () => {
    it('should cache configuration results', async () => {
      const config = { rules: { unknownFields: 'error' } };
      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      // First call
      const result1 = await loadConfig(tempDir);
      
      // Modify file (should not affect cached result)
      await fs.writeFile(configPath, JSON.stringify({ rules: { unknownFields: 'warning' } }));
      
      // Second call should return cached result
      const result2 = await loadConfig(tempDir);
      
      expect(result1).toEqual(result2);
      expect(result2?.rules?.unknownFields).toBe('error'); // Original value
    });
  });

  describe('findConfigFile', () => {
    it('should find first available config file', async () => {
      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, '{}');

      const result = await findConfigFile(tempDir);
      expect(result).toBe(configPath);
    });

    it('should return null when no config file exists', async () => {
      const result = await findConfigFile(tempDir);
      expect(result).toBeNull();
    });

    it('should validate project root path for security', async () => {
      await expect(findConfigFile('../../../etc')).rejects.toThrow('Invalid project root path');
    });

    it('should skip invalid config paths', async () => {
      // Create a config file that would be outside project root via symlink
      const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-'));
      const configContent = '{}';
      
      try {
        // This test might not work on systems without symlink support
        const linkPath = path.join(tempDir, '.cclintrc.json');
        const targetPath = path.join(outsideDir, 'malicious.json');
        
        await fs.writeFile(targetPath, configContent);
        await fs.symlink(targetPath, linkPath);
        
        const result = await findConfigFile(tempDir);
        expect(result).toBeNull(); // Should skip invalid symlink
      } catch (error) {
        // Skip test on systems that don't support symlinks
        if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'ENOTSUP') {
          console.log('Skipping symlink test (not supported on this system)');
          return;
        }
        throw error;
      } finally {
        await fs.rm(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration without errors', () => {
      const config: CclintConfig = {
        rules: {
          unknownFields: 'error',
          strict: true,
          includePatterns: ['src/**'],
          excludePatterns: ['**/*.test.ts']
        },
        agentSchema: {
          extend: {},
          customValidation: () => []
        },
        commandSchema: {
          extend: {}
        },
        settingsSchema: {
          extend: {}
        },
        claudeMdRules: {
          requiredSections: ['description'],
          recommendedSections: ['usage'],
          customValidation: () => []
        }
      };

      const errors = validateConfig(config);
      expect(errors).toEqual([]);
    });

    it('should report schema extension errors', () => {
      const config = {
        agentSchema: {
          extend: 'not an object',
          customValidation: 'not a function'
        }
      } as unknown as CclintConfig;

      const errors = validateConfig(config);
      expect(errors).toContain('agentSchema.extend must be an object');
      expect(errors).toContain('agentSchema.customValidation must be a function');
    });

    it('should validate claudeMdRules structure', () => {
      const config = {
        claudeMdRules: {
          requiredSections: 'not an array',
          recommendedSections: 'not an array',
          customValidation: 'not a function'
        }
      } as unknown as CclintConfig;

      const errors = validateConfig(config);
      expect(errors).toContain('claudeMdRules.requiredSections must be an array');
      expect(errors).toContain('claudeMdRules.recommendedSections must be an array');
      expect(errors).toContain('claudeMdRules.customValidation must be a function');
    });

    it('should validate rules structure', () => {
      const config = {
        rules: {
          unknownFields: 'invalid-value',
          strict: 'not a boolean',
          includePatterns: 'not an array',
          excludePatterns: 'not an array'
        }
      } as unknown as CclintConfig;

      const errors = validateConfig(config);
      expect(errors).toContain('rules.unknownFields must be one of: error, warning, suggestion, ignore');
      expect(errors).toContain('rules.strict must be a boolean');
      expect(errors).toContain('rules.includePatterns must be an array');
      expect(errors).toContain('rules.excludePatterns must be an array');
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge configuration with defaults', () => {
      const config: CclintConfig = {
        rules: {
          strict: true
        }
      };

      const merged = mergeWithDefaults(config);
      
      expect(merged.rules?.unknownFields).toBe('warning'); // Default value
      expect(merged.rules?.strict).toBe(true); // User value
      expect(merged.rules?.includePatterns).toEqual([]); // Default value
      expect(merged.claudeMdRules?.requiredSections).toEqual([]); // Default value
    });

    it('should preserve user values over defaults', () => {
      const config: CclintConfig = {
        rules: {
          unknownFields: 'error',
          strict: true,
          includePatterns: ['custom/**']
        },
        claudeMdRules: {
          requiredSections: ['title', 'description']
        }
      };

      const merged = mergeWithDefaults(config);
      
      expect(merged.rules?.unknownFields).toBe('error');
      expect(merged.rules?.includePatterns).toEqual(['custom/**']);
      expect(merged.claudeMdRules?.requiredSections).toEqual(['title', 'description']);
    });
  });

  describe('enhanced security validation tests', () => {
    it('should accept configuration with __proto__ (security validation removed)', async () => {
      const configWithProto = `
        module.exports = {
          rules: { unknownFields: 'warning' },
          '__proto__': { polluted: true }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, configWithProto);

      const result = await loadConfig(tempDir);
      expect(result).toEqual({
        rules: { unknownFields: 'warning' }
      }); // Now accepts __proto__ since security validation was removed
    });

    it('should accept configuration with constructor manipulation (security validation removed)', async () => {
      const configWithConstructor = `
        const config = {
          rules: { unknownFields: 'warning' }
        };
        config.constructor.prototype.polluted = 'dangerous';
        module.exports = config;
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, configWithConstructor);

      const result = await loadConfig(tempDir);
      expect(result).toEqual({
        rules: { unknownFields: 'warning' }
      }); // Now accepts constructor patterns since security validation was removed for Zod support
    });

    it('should reject configuration files with obvious malicious patterns via static analysis', async () => {
      const maliciousConfig = `
        const { exec } = require('child_process');
        exec('rm -rf /');
        module.exports = {
          rules: { unknownFields: 'warning' }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, maliciousConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeNull(); // Should reject due to static analysis
    });

    it('should reject configuration with eval usage', async () => {
      const maliciousConfig = `
        eval('global.polluted = true');
        module.exports = {
          rules: { unknownFields: 'warning' }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, maliciousConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeNull(); // Should reject eval usage
    });

    it('should accept clean configuration files', async () => {
      const cleanConfig = `
        module.exports = {
          rules: {
            unknownFields: 'error',
            strict: true
          },
          agentSchema: {
            extend: {
              customField: { type: 'string' }
            }
          }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, cleanConfig);

      const result = await loadConfig(tempDir);
      expect(result).toBeTruthy();
      expect(result?.rules?.unknownFields).toBe('error');
    });

    it('should allow configuration loading to be disabled with allowJs option', async () => {
      const jsConfig = `
        module.exports = {
          rules: { unknownFields: 'warning' }
        };
      `;

      const configPath = path.join(tempDir, 'cclint.config.js');
      await fs.writeFile(configPath, jsConfig);

      // Test with JS loading disabled
      const result = await loadConfig(tempDir, { allowJs: false });
      expect(result).toBeNull(); // Should not load JS config when disabled
    });
  });

  describe('configuration validation edge cases', () => {
    it('should handle null and undefined values gracefully', () => {
      const config = {
        agentSchema: null,
        commandSchema: undefined,
        rules: {
          strict: null
        }
      } as unknown as CclintConfig;

      const errors = validateConfig(config);
      expect(errors).toContain('rules.strict must be a boolean');
    });

    it('should validate nested object types', () => {
      const config = {
        claudeMdRules: 'not an object'
      } as unknown as CclintConfig;

      const errors = validateConfig(config);
      expect(errors).toContain('claudeMdRules must be an object');
    });
  });

  describe('error handling', () => {
    it('should handle file read permission errors gracefully', async () => {
      // Create a config file then remove read permissions
      const configPath = path.join(tempDir, '.cclintrc.json');
      await fs.writeFile(configPath, '{}');
      
      try {
        await fs.chmod(configPath, 0o000); // Remove all permissions
        const result = await loadConfig(tempDir);
        expect(result).toBeNull(); // Should handle permission error gracefully
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(configPath, 0o644);
      }
    });

    it('should handle directory access errors gracefully', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      const result = await loadConfig(nonExistentDir);
      expect(result).toBeNull(); // Should handle gracefully
    });
  });
});

// Mock vi for testing environments that might not have it
declare global {
  const vi: {
    spyOn: (obj: Record<string, unknown>, method: string) => {
      mockImplementation: (fn: () => void) => void;
      mockRestore: () => void;
    };
  };
}

// Fallback mock if vi is not available
if (typeof vi === 'undefined') {
  (globalThis as Record<string, unknown>).vi = {
    spyOn: () => ({
      mockImplementation: () => {},
      mockRestore: () => {}
    })
  };
}