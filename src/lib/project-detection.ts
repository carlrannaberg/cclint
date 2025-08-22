import { promises as fs } from 'fs';
import * as path from 'path';
import { loadConfig, validateConfig, mergeWithDefaults } from './config.js';
import type { ProjectInfo } from '../types/index.js';

/**
 * Project detection with directory climbing
 * Looks for .git, package.json, or .claude directory to find project root
 */

export async function findProjectRoot(startPath: string = process.cwd()): Promise<string> {
  let currentPath = path.resolve(startPath);
  const rootPath = path.parse(currentPath).root;

  while (currentPath !== rootPath) {
    // Check for project root markers
    const markers = ['.git', 'package.json', '.claude'];
    
    for (const marker of markers) {
      const markerPath = path.join(currentPath, marker);
      try {
        const stat = await fs.stat(markerPath);
        if (stat.isDirectory() || stat.isFile()) {
          return currentPath;
        }
      } catch {
        // Marker doesn't exist, continue
      }
    }

    // Move up one directory
    currentPath = path.dirname(currentPath);
  }

  // If no project root found, return the original path
  return path.resolve(startPath);
}

export async function detectProjectInfo(projectRoot: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    root: projectRoot,
    hasGit: false,
    hasClaudeDir: false,
    hasPackageJson: false,
  };

  // Check for .git
  try {
    await fs.stat(path.join(projectRoot, '.git'));
    info.hasGit = true;
  } catch {
    // No git directory
  }

  // Check for .claude directory
  try {
    await fs.stat(path.join(projectRoot, '.claude'));
    info.hasClaudeDir = true;
  } catch {
    // No .claude directory
  }

  // Check for package.json and extract info
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageContent);
    
    info.hasPackageJson = true;
    if (packageJson.name) {
      info.projectName = packageJson.name;
    }
  } catch {
    // No package.json or invalid JSON
  }

  // Detect package manager
  info.packageManager = await detectPackageManager(projectRoot);

  // Load cclint configuration (cached to avoid multiple loads)
  try {
    const config = await loadConfig(projectRoot);
    if (config) {
      const configErrors = validateConfig(config);
      if (configErrors.length > 0) {
        // Only warn in verbose mode to avoid noise
        if (process.env.CCLINT_VERBOSE) {
          console.warn('Configuration validation warnings:', configErrors);
        }
      }
      info.cclintConfig = mergeWithDefaults(config);
    }
  } catch (error) {
    // Only show config loading errors in verbose mode
    if (process.env.CCLINT_VERBOSE) {
      console.warn('Failed to load cclint configuration:', error);
    }
  }

  return info;
}

async function detectPackageManager(projectRoot: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun' | undefined> {
  const lockFiles: Array<{ file: string; manager: 'npm' | 'yarn' | 'pnpm' | 'bun' }> = [
    { file: 'bun.lockb', manager: 'bun' },
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'package-lock.json', manager: 'npm' },
  ];

  for (const { file, manager } of lockFiles) {
    try {
      await fs.stat(path.join(projectRoot, file));
      return manager;
    } catch {
      // Lock file doesn't exist
    }
  }

  return undefined;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}