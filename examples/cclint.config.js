// Example cclint configuration file
// This shows how to extend the base schemas with custom fields and validation

import { z } from 'zod';

export default {
  // Extend agent frontmatter with custom fields
  agentSchema: {
    extend: {
      // Add priority field for agent importance
      priority: z.number().min(1).max(5).describe('Agent priority level (1-5)'),
      
      // Add tags for categorization
      tags: z.array(z.string()).optional().describe('Categorization tags'),
      
      // Add experimental flag
      experimental: z.boolean().optional().describe('Experimental feature flag'),
      
      // Add maintainer information
      maintainer: z.string().email().optional().describe('Agent maintainer email')
    },
    
    // Custom validation logic
    customValidation: (data) => {
      const errors = [];
      
      // Experimental agents must be clearly marked
      if (data.experimental && !data.description?.includes('EXPERIMENTAL')) {
        errors.push('Experimental agents must include "EXPERIMENTAL" in description');
      }
      
      // High priority agents need maintainers
      if (data.priority >= 4 && !data.maintainer) {
        errors.push('High priority agents (4-5) must have a maintainer assigned');
      }
      
      // Validate tag conventions
      if (data.tags) {
        const validTags = ['ai', 'automation', 'analysis', 'review', 'testing', 'build'];
        const invalidTags = data.tags.filter(tag => !validTags.includes(tag));
        if (invalidTags.length > 0) {
          errors.push(`Invalid tags: ${invalidTags.join(', ')}. Use: ${validTags.join(', ')}`);
        }
      }
      
      return errors;
    }
  },
  
  // Extend command schema
  commandSchema: {
    extend: {
      // Add timeout configuration
      timeout: z.number().positive().optional().describe('Command timeout in milliseconds'),
      
      // Add retry configuration
      retryCount: z.number().min(0).max(3).default(0).describe('Number of retries on failure'),
      
      // Add async flag
      async: z.boolean().optional().describe('Run command asynchronously')
    },
    
    customValidation: (data) => {
      const errors = [];
      
      // Async commands should have timeouts
      if (data.async && !data.timeout) {
        errors.push('Async commands should specify a timeout');
      }
      
      // Long timeouts should be documented
      if (data.timeout && data.timeout > 30000 && !data.description?.includes('long-running')) {
        errors.push('Commands with timeout > 30s should mention "long-running" in description');
      }
      
      return errors;
    }
  },
  
  // Extend settings schema for team configuration
  settingsSchema: {
    extend: {
      // Team-specific hooks
      teamHooks: z.record(z.array(z.string())).optional(),
      
      // Project metadata
      project: z.object({
        name: z.string(),
        team: z.string(),
        version: z.string().regex(/^\d+\.\d+\.\d+$/)
      }).optional()
    }
  },
  
  // Custom CLAUDE.md requirements
  claudeMdRules: {
    requiredSections: [
      'project overview',
      'development setup',
      'testing strategy',
      'deployment process'
    ],
    
    recommendedSections: [
      'architecture',
      'troubleshooting',
      'api documentation'
    ],
    
    customValidation: (content, sections) => {
      const errors = [];
      
      // Security section is mandatory
      if (!content.toLowerCase().includes('security')) {
        errors.push('CLAUDE.md must include a Security section');
      }
      
      // Code of conduct reference
      if (!content.includes('CODE_OF_CONDUCT') && !content.includes('code of conduct')) {
        errors.push('CLAUDE.md should reference code of conduct');
      }
      
      return errors;
    }
  },
  
  // Global linting rules
  rules: {
    // Treat unknown fields as errors
    unknownFields: 'error',
    
    // Enable strict mode
    strict: true,
    
    // Include additional patterns
    includePatterns: [
      'custom-agents/**/*.md',
      'team-commands/**/*.md'
    ],
    
    // Exclude legacy and deprecated files
    excludePatterns: [
      '**/legacy/**',
      '**/deprecated/**',
      '**/*.backup.*'
    ]
  }
};