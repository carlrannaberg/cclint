import { z } from 'zod';
import type { CclintConfig } from '../types/index.js';
import { validateColor } from '../linters/base.js';

/**
 * Validation schemas for Claude Code project files with extensible architecture
 */

// Agent Categories
const AgentCategorySchema = z.enum([
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
]);

// Model options
const ModelSchema = z
  .enum(['opus', 'sonnet', 'haiku'])
  .or(z.string())
  .optional();

// Command Category
const CommandCategorySchema = z.enum([
  'workflow',
  'ai-assistant', 
  'validation',
]).optional();

// Base Agent/Subagent frontmatter schema (extensible)
const BaseAgentFrontmatterSchema = z.object({
  // Required fields
  name: z
    .string()
    .min(1, 'name is required')
    .regex(/^[a-z0-9-]+$/, 'name must use only lowercase letters, numbers, and hyphens'),
  description: z
    .string()
    .min(1, 'description is required')
    .describe('Natural language description of when this subagent should be invoked'),

  // Optional Claude Code fields
  tools: z
    .string()
    .nullable()
    .optional()
    .describe('Comma-separated list of tools (inherits all if omitted)'),
  model: ModelSchema.describe('Preferred model for this agent'),
  color: z.string().optional().refine(
    (color) => color === undefined || validateColor(color, CSS_NAMED_COLORS),
    { message: 'Color must be a valid hex color (#RRGGBB or #RRGGBBAA) or a CSS named color' }
  ).describe('UI color scheme (hex or CSS named color)'),
});

// Base Command frontmatter schema (extensible)
const BaseCommandFrontmatterSchema = z.object({
  // Official Claude Code fields
  'allowed-tools': z.string().optional().describe('List of tools the command can use'),
  'argument-hint': z.string().optional().describe('The arguments expected for the slash command'),
  description: z.string().optional().describe('Brief description of the command'),
  model: ModelSchema.describe('Model to use for this command'),

  // Claudekit extension
  category: CommandCategorySchema.describe('Category for organizing commands'),
});

// Base Claude settings.json schema (extensible)
const BaseClaudeSettingsSchema = z.object({
  hooks: z.object({}).catchall(
    z.array(
      z.object({
        matcher: z.string().describe('Tool matcher pattern'),
        hooks: z.array(
          z.object({
            type: z.literal('command').describe('Hook type'),
            command: z.string().describe('Command to execute'),
          })
        ),
      })
    )
  ).optional(),
});

/**
 * Create extended schema by merging base schema with custom extensions
 */
export function createExtendedSchema(
  baseSchema: z.ZodObject<z.ZodRawShape>,
  extensions?: Record<string, z.ZodType>,
  strict: boolean = true
): z.ZodType {
  if (!extensions || Object.keys(extensions).length === 0) {
    return strict ? baseSchema.strict() : baseSchema.passthrough();
  }

  const extendedSchema = baseSchema.extend(extensions);
  return strict ? extendedSchema.strict() : extendedSchema.passthrough();
}

/**
 * Get agent schema with optional custom extensions
 */
export function getAgentSchema(config?: CclintConfig): z.ZodType {
  const agentConfig = config?.agentSchema;
  
  if (agentConfig?.override) {
    return agentConfig.override;
  }
  
  const isStrict = config?.rules?.strict !== false;
  return createExtendedSchema(BaseAgentFrontmatterSchema, agentConfig?.extend, isStrict);
}

/**
 * Get command schema with optional custom extensions
 */
export function getCommandSchema(config?: CclintConfig): z.ZodType {
  const commandConfig = config?.commandSchema;
  
  if (commandConfig?.override) {
    return commandConfig.override;
  }
  
  const isStrict = config?.rules?.strict !== false;
  return createExtendedSchema(BaseCommandFrontmatterSchema, commandConfig?.extend, isStrict);
}

/**
 * Get settings schema with optional custom extensions
 */
export function getSettingsSchema(config?: CclintConfig): z.ZodType {
  const settingsConfig = config?.settingsSchema;
  
  if (settingsConfig?.override) {
    return settingsConfig.override;
  }
  
  const isStrict = config?.rules?.strict !== false;
  return createExtendedSchema(BaseClaudeSettingsSchema, settingsConfig?.extend, isStrict);
}

// Export default schemas for backward compatibility
export const AgentFrontmatterSchema = BaseAgentFrontmatterSchema.strict();
export const CommandFrontmatterSchema = BaseCommandFrontmatterSchema.strict();
export const ClaudeSettingsSchema = BaseClaudeSettingsSchema.catchall(z.unknown()).describe('Claude Code settings configuration');

// Known Claude Code tools
export const KNOWN_CLAUDE_TOOLS = new Set([
  'Read',
  'Write', 
  'Edit',
  'MultiEdit',
  'Bash',
  'Grep',
  'Glob',
  'LS',
  'Task',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'BashOutput',
  'KillBash',
  'ExitPlanMode',
]);

// CSS named colors for validation
export const CSS_NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque',
  'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue',
  'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew',
  'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
  'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
  'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
  'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose',
  'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown',
  'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato',
  'turquoise', 'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);

// Expected CLAUDE.md sections (based on AGENTS.md template)
export const REQUIRED_CLAUDE_MD_SECTIONS = [
  'navigating the codebase',
  'build & commands', 
  'using subagents',
  'code style',
  'testing',
  'security',
  'configuration',
];

export const RECOMMENDED_CLAUDE_MD_SECTIONS = [
  'git commit conventions',
  'architecture',
  'naming conventions',
  'cli tools reference',
];