import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { CclintConfig, CclintConfigExport } from '../types/index.js';

/**
 * Configuration file names in order of precedence (first found wins)
 */
const CONFIG_FILES = [
  'cclint.config.js',
  'cclint.config.mjs', 
  'cclint.config.ts',
  '.cclintrc.json',
  '.cclintrc.js',
  '.cclintrc.mjs',
];

/**
 * Configuration cache to avoid multiple loads
 */
const configCache = new Map<string, CclintConfig | null>();

/**
 * Load cclint configuration from project directory
 */
export async function loadConfig(projectRoot: string): Promise<CclintConfig | null> {
  // Check cache first
  if (configCache.has(projectRoot)) {
    return configCache.get(projectRoot) || null;
  }
  let config: CclintConfig | null = null;

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    
    try {
      const exists = await fs.access(configPath).then(() => true).catch(() => false);
      if (!exists) continue;

      if (configFile.endsWith('.json')) {
        config = await loadJsonConfig(configPath);
      } else {
        config = await loadJsConfig(configPath);
      }
      break; // Found config, stop looking
    } catch (error) {
      // Log error but continue trying other config files
      if (process.env.CCLINT_VERBOSE) {
        console.warn(`Failed to load config from ${configFile}:`, error);
      }
    }
  }

  // Cache the result (even if null)
  configCache.set(projectRoot, config);
  return config;
}

/**
 * Load JSON configuration file
 */
async function loadJsonConfig(configPath: string): Promise<CclintConfig> {
  const content = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);
  
  // Basic validation that it's an object
  if (typeof config !== 'object' || config === null) {
    throw new Error('Configuration must be an object');
  }
  
  return config as CclintConfig;
}

/**
 * Load JavaScript/TypeScript configuration file
 */
async function loadJsConfig(configPath: string): Promise<CclintConfig> {
  // Convert to file URL for import()
  const fileUrl = pathToFileURL(configPath).href;
  
  try {
    const module = await import(fileUrl);
    let config: CclintConfigExport = module.default || module;
    
    // Handle function exports
    if (typeof config === 'function') {
      config = await config();
    }
    
    // Validate result is an object
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration export must be an object or function returning an object');
    }
    
    return config as CclintConfig;
    
  } catch (error) {
    // For TypeScript files, suggest using .js or building first
    if (configPath.endsWith('.ts')) {
      throw new Error(
        `Failed to load TypeScript config file. Consider using cclint.config.js instead, or compile to JavaScript first.\nOriginal error: ${error}`
      );
    }
    throw error;
  }
}

/**
 * Validate configuration object structure
 */
export function validateConfig(config: CclintConfig): string[] {
  const errors: string[] = [];
  
  // Validate schema extensions
  for (const schemaKey of ['agentSchema', 'commandSchema', 'settingsSchema'] as const) {
    const schema = config[schemaKey];
    if (schema && typeof schema !== 'object') {
      errors.push(`${schemaKey} must be an object`);
      continue;
    }
    
    if (schema) {
      if (schema.extend && typeof schema.extend !== 'object') {
        errors.push(`${schemaKey}.extend must be an object`);
      }
      
      if (schema.customValidation && typeof schema.customValidation !== 'function') {
        errors.push(`${schemaKey}.customValidation must be a function`);
      }
    }
  }
  
  // Validate claudeMdRules
  if (config.claudeMdRules) {
    const rules = config.claudeMdRules;
    if (typeof rules !== 'object') {
      errors.push('claudeMdRules must be an object');
    } else {
      if (rules.requiredSections && !Array.isArray(rules.requiredSections)) {
        errors.push('claudeMdRules.requiredSections must be an array');
      }
      
      if (rules.recommendedSections && !Array.isArray(rules.recommendedSections)) {
        errors.push('claudeMdRules.recommendedSections must be an array');
      }
      
      if (rules.customValidation && typeof rules.customValidation !== 'function') {
        errors.push('claudeMdRules.customValidation must be a function');
      }
    }
  }
  
  // Validate global rules
  if (config.rules) {
    const rules = config.rules;
    if (typeof rules !== 'object') {
      errors.push('rules must be an object');
    } else {
      if (rules.unknownFields && !['error', 'warning', 'suggestion', 'ignore'].includes(rules.unknownFields)) {
        errors.push('rules.unknownFields must be one of: error, warning, suggestion, ignore');
      }
      
      if (rules.strict !== undefined && typeof rules.strict !== 'boolean') {
        errors.push('rules.strict must be a boolean');
      }
      
      if (rules.includePatterns && !Array.isArray(rules.includePatterns)) {
        errors.push('rules.includePatterns must be an array');
      }
      
      if (rules.excludePatterns && !Array.isArray(rules.excludePatterns)) {
        errors.push('rules.excludePatterns must be an array');
      }
    }
  }
  
  return errors;
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults(config: CclintConfig): CclintConfig {
  return {
    rules: {
      unknownFields: 'warning',
      strict: false,
      includePatterns: [],
      excludePatterns: [],
      ...config.rules,
    },
    claudeMdRules: {
      requiredSections: [],
      recommendedSections: [],
      ...config.claudeMdRules,
    },
    ...config,
  };
}

/**
 * Get configuration file path if it exists
 */
export async function findConfigFile(projectRoot: string): Promise<string | null> {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    const exists = await fs.access(configPath).then(() => true).catch(() => false);
    if (exists) {
      return configPath;
    }
  }
  return null;
}