import { z } from 'zod';
import type { CclintConfig } from '../types/index.js';

/**
 * Validation schemas for Claude Code project files with extensible architecture
 */

// Model options - valid Claude Code model values
const ModelSchema = z
  .enum(['sonnet', 'opus', 'haiku', 'sonnet[1m]', 'opusplan', 'inherit'])
  .optional()
  .describe('Model to use (defaults to sonnet if not specified)');

// Valid Claude Code UI colors - limited to 8 standard colors
const VALID_CLAUDE_COLORS = new Set([
  'red',
  'blue', 
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
]);

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
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Tool access: "*" for all, array of tool names, or omit for default ["*"]'),
  'allowed-tools': z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Alternative name for tools field'),
  model: ModelSchema.describe('Preferred model for this agent'),
  color: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) return true; // optional field
        // Only allow the 8 valid Claude Code colors
        return VALID_CLAUDE_COLORS.has(value.toLowerCase());
      },
      (value) => ({
        message: `Color "${value}" is not a valid Claude Code color. Valid colors are: ${Array.from(VALID_CLAUDE_COLORS).join(', ')}`
      })
    )
    .describe('UI color scheme (must be one of the 8 valid Claude Code colors)'),
});

// Base Command frontmatter schema (extensible)
const BaseCommandFrontmatterSchema = z.object({
  // Official Claude Code fields (all optional)
  'allowed-tools': z.string().optional().describe('List of tools the command can use'),
  'argument-hint': z.string().optional().describe('The arguments expected for the slash command'),
  description: z.string().optional().describe('Brief description of the command'),
  model: ModelSchema.describe('Model to use for this command'),
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

// Export valid colors and model schema for use in other modules
export { VALID_CLAUDE_COLORS, ModelSchema };