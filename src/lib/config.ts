import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { CclintConfig, CclintConfigExport } from '../types/index.js';

/**
 * Configuration file names in order of precedence (first found wins)
 * For security, we prioritize JSON files and restrict JS files
 */
const CONFIG_FILES = [
  '.cclintrc.json',          // Safe JSON config (preferred)
  'cclint.config.json',      // Safe JSON config  
  'cclint.config.js',        // Restricted JS config
  'cclint.config.mjs',       // Restricted JS config
  '.cclintrc.js',            // Restricted JS config
  '.cclintrc.mjs',           // Restricted JS config
  // NOTE: TypeScript configs removed for security (prevent arbitrary code execution)
];

/**
 * Configuration cache to avoid multiple loads
 */
const configCache = new Map<string, CclintConfig | null>();

/**
 * Dangerous system paths that should not be accessed
 */
const DANGEROUS_SYSTEM_PATHS = ['/etc/passwd', '/etc/shadow', '/etc/hosts', '/usr/bin', '/usr/sbin', '/sys', '/proc', '/dev', '/bin', '/sbin'];

/**
 * Check if a path is a dangerous system directory
 */
function isSystemPath(resolvedPath: string): boolean {
  return DANGEROUS_SYSTEM_PATHS.some(dangerousPath => 
    resolvedPath.startsWith(dangerousPath) || resolvedPath === dangerousPath
  );
}

/**
 * Validate and resolve a project root path with security checks
 */
function validateProjectRoot(projectRoot: string): string {
  // Basic input validation
  if (!projectRoot || typeof projectRoot !== 'string' || projectRoot.includes('\0') || projectRoot.trim() === '') {
    throw new Error(`Invalid project root path: contains unsafe characters or patterns`);
  }
  
  const cleanPath = projectRoot.trim();
  
  // Check for obvious path traversal attacks
  if (cleanPath.includes('..')) {
    throw new Error(`Invalid project root path: path traversal detected with '../'`);
  }
  
  // Resolve to absolute path
  const resolvedPath = path.resolve(cleanPath);
  
  // Check against dangerous system paths
  if (isSystemPath(resolvedPath)) {
    throw new Error(`Invalid project root path: cannot access system directory ${resolvedPath}`);
  }
  
  return resolvedPath;
}

/**
 * Load cclint configuration from project directory with security validation.
 * 
 * Searches for configuration files in order of precedence:
 * 1. .cclintrc.json (Safe JSON - preferred)
 * 2. cclint.config.json (Safe JSON)
 * 3. cclint.config.js (JavaScript with limited security restrictions)
 * 4. cclint.config.mjs (ES modules with limited security restrictions)
 * 5. .cclintrc.js (JavaScript with limited security restrictions)
 * 6. .cclintrc.mjs (ES modules with limited security restrictions)
 * 
 * SECURITY FEATURES:
 * - Path traversal protection prevents access outside project boundaries
 * - Static code analysis detects dangerous system access patterns
 * - Execution timeout prevents hanging configuration functions
 * 
 * NOTE: Runtime object validation has been removed to support Zod schemas
 * and other legitimate uses of prototype properties in configuration files.
 * 
 * @param {string} projectRoot - Absolute path to project root directory
 * @param {Object} [options] - Configuration loading options
 * @param {boolean} [options.allowJs=true] - Whether to allow JavaScript configuration files
 * @returns {Promise<CclintConfig|null>} Loaded configuration or null if none found
 * @throws {Error} If path is invalid or contains security risks
 * 
 * @example
 * ```typescript
 * // Load configuration with JavaScript disabled for maximum security
 * const config = await loadConfig('/path/to/project', { allowJs: false });
 * 
 * // Standard usage (JavaScript configs allowed with warnings)
 * const config = await loadConfig('/path/to/project');
 * ```
 */
export async function loadConfig(projectRoot: string, options: { allowJs?: boolean } = {}): Promise<CclintConfig | null> {
  // Validate and resolve project root path
  projectRoot = validateProjectRoot(projectRoot);

  // Check cache first
  if (configCache.has(projectRoot)) {
    return configCache.get(projectRoot) || null;
  }
  let config: CclintConfig | null = null;

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    
    // Security check: Ensure config file path is within project boundaries
    const relativePath = path.relative(projectRoot, configPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      if (process.env.CCLINT_VERBOSE) {
        console.warn(`[SECURITY] Skipping config file outside project boundary: ${configFile}`);
      }
      continue;
    }
    
    try {
      const exists = await fs.access(configPath).then(() => true).catch(() => false);
      if (!exists) continue;

      if (configFile.endsWith('.json')) {
        config = await loadJsonConfig(configPath);
      } else {
        // Check if JS configs are disabled
        if (options.allowJs === false) {
          if (process.env.CCLINT_VERBOSE) {
            console.warn(`[SECURITY] JavaScript configuration loading is disabled: ${configFile}`);
          }
          continue;
        }
        config = await loadJsConfig(configPath, projectRoot);
      }
      break; // Found config, stop looking
    } catch (error) {
      // For security errors, log and return null (fail gracefully)
      if (error instanceof Error && error.message.includes('[SECURITY]')) {
        if (process.env.CCLINT_VERBOSE) {
          console.warn(`Security validation failed for ${configFile}:`, error.message);
        }
        // Cache the null result for security failures
        configCache.set(projectRoot, null);
        return null;
      }
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
 * Load JavaScript configuration file with enhanced security restrictions
 * SECURITY: Multiple layers of protection against code execution attacks
 * WARNING: This function executes user-provided JavaScript code and should only be used with trusted files
 */
async function loadJsConfig(configPath: string, projectRoot: string): Promise<CclintConfig> {
  // Enhanced security validation
  const fileName = path.basename(configPath);
  const configDir = path.dirname(configPath);
  
  // Verify the config file is exactly within the specified project root
  const realConfigPath = await fs.realpath(configPath).catch(() => configPath);
  const realProjectRoot = await fs.realpath(projectRoot).catch(() => projectRoot);
  const relativePath = path.relative(realProjectRoot, realConfigPath);
  
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[SECURITY] Configuration file is outside project boundary: ${configPath}`);
  }
  
  // Only allow specific config file names
  if (!CONFIG_FILES.includes(fileName)) {
    throw new Error(`[SECURITY] Invalid configuration file name: ${fileName}. Must be one of: ${CONFIG_FILES.join(', ')}`);
  }
  
  // Additional file content security checks before execution
  let fileContent: string;
  try {
    fileContent = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read configuration file: ${configPath}`);
  }
  
  // Static analysis for obvious malicious patterns
  const dangerousPatterns = [
    /require\s*\(["'](?:child_process|fs|path|os|cluster)["']\)/,
    /import.*["'](?:child_process|fs|path|os|cluster)["']/,
    /process\s*\.\s*(?:exec|spawn|exit)/,
    /eval\s*\(/,
    /Function\s*\(/,
    /global(?:This)?\.\w+\s*=/
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(fileContent)) {
      throw new Error(`[SECURITY] Configuration file contains potentially dangerous code pattern: ${configPath}`);
    }
  }

  // Convert to file URL for import()
  const fileUrl = pathToFileURL(configPath).href;
  
  try {
    const module = await import(fileUrl);
    let config: CclintConfigExport = module.default || module;
    
    // Handle function exports with timeout protection
    if (typeof config === 'function') {
      const timeout = 5000; // 5 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Configuration function execution timeout')), timeout);
      });
      
      config = await Promise.race([
        Promise.resolve(config()),
        timeoutPromise
      ]) as CclintConfig;
    }
    
    // Validate result is an object
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration export must be an object or function returning an object');
    }
    
    return config as CclintConfig;
    
  } catch (error) {
    // For TypeScript files, suggest using .json instead
    if (configPath.endsWith('.ts')) {
      throw new Error(
        `TypeScript configuration files are not supported for security reasons. Please use a .json configuration file instead.\nOriginal error: ${error}`
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
    ...config,
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
  };
}

/**
 * Get configuration file path if it exists with enhanced security validation
 * SECURITY: Enhanced path validation to prevent directory traversal attacks
 */
export async function findConfigFile(projectRoot: string): Promise<string | null> {
  // Validate and resolve project root path
  projectRoot = validateProjectRoot(projectRoot);

  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(projectRoot, configFile);
    
    const exists = await fs.access(configPath).then(() => true).catch(() => false);
    if (exists) {
      // Security check: ensure the config file doesn't link outside the project directory
      try {
        const realConfigPath = await fs.realpath(configPath);
        const realProjectRoot = await fs.realpath(projectRoot);
        const relativePath = path.relative(realProjectRoot, realConfigPath);
        
        // If the real path is outside the project directory, skip this config file
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          if (process.env.CCLINT_VERBOSE) {
            console.warn(`[SECURITY] Skipping config file that links outside project: ${configFile}`);
          }
          continue; // Skip this config file and try the next one
        }
        
        return configPath;
      } catch (error) {
        // If we can't resolve the real path, skip this config file for security
        if (process.env.CCLINT_VERBOSE) {
          console.warn(`[SECURITY] Skipping config file due to path resolution error: ${configFile}`);
        }
        continue;
      }
    }
  }
  return null;
}