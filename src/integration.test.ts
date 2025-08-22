import { describe, it, expect } from 'vitest';
import { getAgentSchema, getCommandSchema, getSettingsSchema } from './lib/schemas.js';
import { handleZodValidationIssue, shouldSkipFile } from './linters/base.js';
import type { CclintConfig, LintResult } from './types/index.js';
import { z } from 'zod';

describe('Schema Integration Tests', () => {
  
  describe('Custom Schema Extensions', () => {
    it('should create extended agent schema with custom fields', () => {
      const config: CclintConfig = {
        agentSchema: {
          extend: {
            customField: z.string(),
            optionalField: z.number().optional()
          }
        }
      };

      const schema = getAgentSchema(config);
      
      // Test that extended schema accepts custom fields
      const validData = {
        name: 'test-agent',
        description: 'Test agent',
        tools: 'bash',
        customField: 'custom value',
        optionalField: 42
      };

      const result = schema.safeParse(validData);
      if (!result.success) {
        console.log('Agent schema validation failed:', result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it('should create extended command schema with custom fields', () => {
      const config: CclintConfig = {
        commandSchema: {
          extend: {
            customCommandField: z.string()
          }
        }
      };

      const schema = getCommandSchema(config);
      
      const validData = {
        name: 'test-command',
        description: 'Test command',
        tools: 'bash',
        customCommandField: 'custom value'
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should create extended settings schema with custom fields', () => {
      const config: CclintConfig = {
        settingsSchema: {
          extend: {
            customSetting: z.string()
          }
        }
      };

      const schema = getSettingsSchema(config);
      
      const validData = {
        name: 'Test Project',
        customSetting: 'custom value'
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should support schema override', () => {
      const customSchema = z.object({
        completely: z.string(),
        different: z.number()
      });

      const config: CclintConfig = {
        agentSchema: {
          override: customSchema
        }
      };

      const schema = getAgentSchema(config);
      
      const validData = {
        completely: 'different',
        different: 123
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
      
      // Should reject standard agent fields
      const invalidData = {
        name: 'test-agent',
        description: 'Test agent'
      };

      const invalidResult = schema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Validation Issue Handling', () => {
    it('should handle unrecognized keys consistently', () => {
      const result: LintResult = {
        file: 'test.md',
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        unusedFields: [],
        missingFields: []
      };

      const mockAddError = (res: LintResult, msg: string) => res.errors.push(msg);
      const mockAddWarning = (res: LintResult, msg: string) => res.warnings.push(msg);
      const mockAddMissingField = (res: LintResult, field: string) => res.missingFields.push(field);
      const mockAddUnusedField = (res: LintResult, field: string) => res.unusedFields.push(field);

      const unrecognizedIssue = {
        code: 'unrecognized_keys',
        keys: ['unknownField', 'anotherUnknown'],
        path: [],
        message: 'Unrecognized keys'
      };

      handleZodValidationIssue(
        unrecognizedIssue,
        result,
        mockAddError,
        mockAddWarning,
        mockAddMissingField,
        mockAddUnusedField
      );

      expect(result.unusedFields).toEqual(['unknownField', 'anotherUnknown']);
      expect(result.warnings).toEqual([
        'Unrecognized field: unknownField',
        'Unrecognized field: anotherUnknown'
      ]);
    });

    it('should handle missing required fields consistently', () => {
      const result: LintResult = {
        file: 'test.md',
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        unusedFields: [],
        missingFields: []
      };

      const mockAddError = (res: LintResult, msg: string) => res.errors.push(msg);
      const mockAddWarning = (res: LintResult, msg: string) => res.warnings.push(msg);
      const mockAddMissingField = (res: LintResult, field: string) => res.missingFields.push(field);
      const mockAddUnusedField = (res: LintResult, field: string) => res.unusedFields.push(field);

      const missingFieldIssue = {
        code: 'invalid_type',
        received: 'undefined',
        expected: 'string',
        path: ['description'],
        message: 'Required'
      };

      handleZodValidationIssue(
        missingFieldIssue,
        result,
        mockAddError,
        mockAddWarning,
        mockAddMissingField,
        mockAddUnusedField
      );

      expect(result.missingFields).toEqual(['description']);
      expect(result.errors).toEqual(['Missing required field: description']);
    });
  });

  describe('File Pattern Matching', () => {
    it('should skip files based on exclude patterns', () => {
      const patterns = ['**/node_modules/**', '**/*.tmp'];
      
      expect(shouldSkipFile('/project/node_modules/package/file.js', patterns)).toBe(true);
      expect(shouldSkipFile('/project/src/temp.tmp', patterns)).toBe(true);
      expect(shouldSkipFile('/project/src/agent.md', patterns)).toBe(false);
    });

    it('should not skip files when no patterns provided', () => {
      expect(shouldSkipFile('/project/src/agent.md', [])).toBe(false);
      expect(shouldSkipFile('/project/src/agent.md', undefined)).toBe(false);
    });
  });

  describe('Configuration Consistency', () => {
    it('should apply same schema extensions across multiple invocations', () => {
      const config: CclintConfig = {
        agentSchema: {
          extend: {
            sharedField: z.string()
          }
        },
        commandSchema: {
          extend: {
            sharedField: z.string()
          }
        }
      };

      const agentSchema1 = getAgentSchema(config);
      const agentSchema2 = getAgentSchema(config);
      const commandSchema1 = getCommandSchema(config);
      const commandSchema2 = getCommandSchema(config);

      // Both schemas should accept the same custom field
      const testData = {
        name: 'test',
        description: 'test desc',
        tools: 'bash',
        sharedField: 'shared value'
      };

      expect(agentSchema1.safeParse(testData).success).toBe(true);
      expect(agentSchema2.safeParse(testData).success).toBe(true);
      expect(commandSchema1.safeParse(testData).success).toBe(true);
      expect(commandSchema2.safeParse(testData).success).toBe(true);
    });
  });
});