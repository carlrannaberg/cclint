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
      
      priority: z.number().min(1).max(5).optional().describe('Agent priority level'),
      tags: z.array(z.string()).optional().describe('Agent tags for categorization'),
    }
  },
  
  rules: {
    unknownFields: 'warning',
    strict: false,
  }
};