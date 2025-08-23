import { z } from 'zod';

export default {
  agentSchema: {
    extend: {
      // Project-specific extensions for agent frontmatter
      category: z.enum([
        'general',
        'framework', 
        'testing',
        'database',
        'frontend',
        'devops',
        'build',
        'linting',
        'tools',
        'universal',
      ]).optional().describe('Category for grouping agents'),
      
      displayName: z.string().optional().describe('Display name for UI'),
      bundle: z.array(z.string()).optional().describe('Bundled subagent names'),
    }
  },
  
  rules: {
    unknownFields: 'warning',
    strict: false,
  }
};