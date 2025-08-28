# CCLint SDK and Programmatic API Support

**Status**: Draft  
**Authors**: Claude Code Assistant  
**Date**: 2025-08-27  
**Version**: 1.0  

## Overview

Add comprehensive SDK and programmatic API support to CCLint while maintaining full CLI compatibility. This enables developers to integrate CCLint's linting capabilities directly into their applications, build tools, IDEs, and custom scripts without shell execution overhead.

## Background/Problem Statement

Currently, CCLint only operates as a CLI tool, forcing developers who want to integrate Claude Code project validation into their workflows to:

1. **Shell out to CLI**: Inefficient process spawning with limited error handling
2. **Parse text output**: No structured data access, only formatted text
3. **Limited integration**: Cannot easily embed validation in IDEs, build tools, or custom scripts
4. **Performance overhead**: Process startup costs for each validation run
5. **Error handling complexity**: Must parse exit codes and stdout/stderr text

Popular linting tools like ESLint, Jest, and Prettier solve this by providing both CLI and programmatic APIs. This pattern allows:
- **Build tool integration**: Webpack, Vite, Rollup plugins
- **IDE support**: Real-time validation and error highlighting  
- **Custom scripts**: Automated validation in CI/CD pipelines

## Goals

- ✅ Expose CCLint's core linting functionality as importable TypeScript/JavaScript API
- ✅ Maintain 100% backward compatibility with existing CLI interface
- ✅ Provide structured data access to linting results and configuration
- ✅ Support both CommonJS and ES module imports
- ✅ Preserve all existing security measures and path validation
- ✅ Enable programmatic configuration and custom schema extensions

## Non-Goals

- ❌ Breaking changes to existing CLI interface or behavior
- ❌ Replacing CLI functionality or deprecating command-line usage
- ❌ Web browser compatibility (Node.js focused)
- ❌ GraphQL or REST API endpoints (programmatic library only)
- ❌ Plugin marketplace or external plugin distribution
- ❌ Real-time file watching or daemon mode
- ❌ Performance benchmarking or optimization (separate initiative)
- ❌ Progress tracking callbacks for long-running operations
- ❌ Custom reporter plugin system

## Technical Dependencies

### External Libraries (Current)
- **Zod** v3.22.4 - Schema validation (core to SDK functionality)
- **Commander.js** v11.1.0 - CLI parsing (CLI only, not exposed in SDK)
- **Chalk** v5.3.0 - Terminal colors (CLI only, SDK uses structured data)
- **Gray-matter** v4.0.3 - Frontmatter parsing (used by SDK)
- **Glob** v10.3.10 - File pattern matching (used by SDK)
- **Ora** v8.0.1 - Progress spinners (CLI only)

### Version Requirements
- **Node.js** >= 16.0.0 (current requirement, maintained)
- **TypeScript** >= 4.5.0 (for TypeScript users of SDK)
- **ES2020** target (for broad compatibility)

### Documentation References
- [Zod Documentation](https://zod.dev/) - Schema validation patterns
- [Node.js API Design Best Practices](https://nodejs.org/api/)
- [TypeScript Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/)

## Detailed Design

### Architecture Changes

#### Current Architecture (CLI Only)
```
bin/cclint.js → src/cli.ts → src/commands/lint.ts → src/linters/*
                                     ↓
                              src/reporters/* → stdout
```

#### New Dual Architecture (CLI + SDK)
```
SDK Path:  src/index.ts → src/lib/core.ts → src/linters/*
                                   ↓
                          Structured LintSummary

CLI Path:  bin/cclint.js → src/cli.ts → src/lib/core.ts (shared)
                                           ↓
                              src/reporters/* → stdout
```

### Code Structure and File Organization

#### New Files Required
```
src/
├── index.ts                 # NEW: Main SDK entry point
├── lib/
│   ├── core.ts             # NEW: Extracted core linting logic
│   └── sdk.ts              # NEW: High-level SDK class
├── linters/
│   └── index.ts            # NEW: Linter exports
└── reporters/
    └── index.ts            # NEW: Reporter exports
```

#### Modified Files
```
src/
├── cli.ts                  # MODIFIED: Use extracted core logic
├── commands/lint.ts        # MODIFIED: Delegate to core.ts
└── package.json            # MODIFIED: Add SDK exports
```

### API Changes

#### New SDK Entry Point (`src/index.ts`)
```typescript
// High-level SDK API
export { CClint } from './lib/sdk.js';
export { CClint as default } from './lib/sdk.js';

// Core functions
export {
  lintProject,
  lintFiles,
  loadProjectConfig,
  detectProject
} from './lib/core.js';

// Individual linters for advanced usage
export {
  AgentsLinter,
  CommandsLinter, 
  SettingsLinter,
  ClaudeMdLinter
} from './linters/index.js';

// Reporters
export {
  ConsoleReporter,
  JsonReporter,
  MarkdownReporter
} from './reporters/index.js';

// Configuration and utilities
export {
  loadConfig,
  validateConfig,
  mergeWithDefaults
} from './lib/config.js';

export {
  findProjectRoot,
  detectProjectInfo
} from './lib/project-detection.js';

export {
  sanitizePath,
  isPathSafe,
  calculateSummary
} from './lib/utils.js';

// TypeScript types for SDK consumers
export type {
  // Core types
  CclintConfig,
  LintOptions,
  LintResult,
  LintSummary,
  ProjectInfo,
  FrontmatterData,
  
  // SDK-specific types  
  SDKLintOptions,
  LinterType
} from './types/index.js';

// Schema and validation exports
export {
  getAgentSchema,
  getCommandSchema,
  getSettingsSchema,
  KNOWN_CLAUDE_TOOLS,
  VALID_CLAUDE_COLORS,
  ModelSchema
} from './lib/schemas.js';
```

#### High-Level SDK Class (`src/lib/sdk.ts`)
```typescript
export class CClint {
  constructor(private config?: CclintConfig) {}

  // Main linting methods
  async lintProject(projectRoot?: string, options?: SDKLintOptions): Promise<LintSummary> {
    const root = projectRoot || process.cwd();
    return await lintProject(root, options, this.config);
  }

  async lintAgents(projectRoot?: string, options?: SDKLintOptions): Promise<LintResult[]> {
    const linter = new AgentsLinter();
    return await linter.lint(projectRoot || process.cwd(), this.normalizeOptions(options));
  }

  async lintCommands(projectRoot?: string, options?: SDKLintOptions): Promise<LintResult[]> {
    const linter = new CommandsLinter();
    return await linter.lint(projectRoot || process.cwd(), this.normalizeOptions(options));
  }

  async lintSettings(projectRoot?: string, options?: SDKLintOptions): Promise<LintResult[]> {
    const linter = new SettingsLinter();
    return await linter.lint(projectRoot || process.cwd(), this.normalizeOptions(options));
  }

  async lintClaudeMd(projectRoot?: string, options?: SDKLintOptions): Promise<LintResult[]> {
    const linter = new ClaudeMdLinter();
    return await linter.lint(projectRoot || process.cwd(), this.normalizeOptions(options));
  }

  // Configuration methods
  async loadConfig(projectRoot?: string): Promise<CclintConfig | null> {
    return await loadConfig(projectRoot || process.cwd());
  }

  // Utility methods
  async detectProject(projectRoot?: string): Promise<ProjectInfo> {
    return await detectProjectInfo(projectRoot || process.cwd());
  }

  private normalizeOptions(options?: SDKLintOptions): LintOptions {
    return {
      quiet: false,
      verbose: false,
      format: 'console' as const,
      failOn: 'error' as const,
      customSchemas: true,
      parallel: true,
      concurrency: 10,
      ...options
    };
  }
}
```

#### Core Functions (`src/lib/core.ts`)
```typescript
export async function lintProject(
  projectRoot: string,
  options?: SDKLintOptions,
  config?: CclintConfig
): Promise<LintSummary> {
  // Extracted from commands/lint.ts
  // Remove CLI-specific code (spinners, console output)
  
  const projectInfo = await detectProjectInfo(projectRoot);
  
  // Run linters in parallel (existing logic)
  const linters = [
    new AgentsLinter(),
    new CommandsLinter(),
    new SettingsLinter(),
    new ClaudeMdLinter()
  ];
  
  const results = await Promise.all(
    linters.map(linter => linter.lint(projectRoot, options || {}, projectInfo))
  );
  
  const flatResults = results.flat();
  const summary = calculateSummary(flatResults);
  
  return summary;
}

export async function lintFiles(
  files: string[],
  options?: SDKLintOptions,
  config?: CclintConfig
): Promise<LintSummary> {
  // Similar to lintProject but for specific files
  // Determine linter based on file patterns
}
```

### Data Model Changes

#### New SDK-Specific Types (`src/types/index.ts`)
```typescript
// Extend existing LintOptions for SDK
export interface SDKLintOptions extends Omit<LintOptions, 'format' | 'outputFile'> {
  // Advanced filtering
  includeFiles?: string[];
  excludeFiles?: string[];
  
  // SDK-specific options
  returnRawResults?: boolean;
  includeMetadata?: boolean;
}

export type LinterType = 'agents' | 'commands' | 'settings' | 'claude-md';

// Enhanced LintSummary with SDK metadata
export interface EnhancedLintSummary extends LintSummary {
  metadata?: {
    duration: number;
    nodeVersion: string;
    cclintVersion: string;
    projectRoot: string;
    configPath?: string;
  };
}
```

### Integration with External Libraries

#### Zod Schema Integration
```typescript
// Maintain existing Zod patterns for custom schema extensions
export function createCustomAgentLinter(schema: z.ZodType): AgentsLinter {
  const linter = new AgentsLinter();
  // Override default schema with custom one
  linter.setCustomSchema(schema);
  return linter;
}

// Enable schema composition
export function extendAgentSchema(
  baseSchema: z.ZodType,
  extensions: Record<string, z.ZodType>
): z.ZodType {
  return createExtendedSchema(baseSchema, extensions, true);
}
```

#### Commander.js Isolation
```typescript
// Keep Commander.js isolated to CLI layer
// SDK does not depend on Commander.js
// CLI continues to use Commander.js for argument parsing
```

## User Experience

### SDK Usage Examples

#### Basic Usage
```typescript
import CClint from 'cclint';

// Simple project linting
const linter = new CClint();
const results = await linter.lintProject();

if (results.hasErrors) {
  console.error('Linting failed:', results.errorCount);
  process.exit(1);
}

console.log('✅ All validation passed!');
```

#### Advanced Usage with Custom Configuration
```typescript
import { CClint, loadProjectConfig } from 'cclint';

// Load project-specific configuration
const config = await loadProjectConfig('./my-claude-project');

// Custom configuration
const customConfig = {
  ...config,
  agentSchema: {
    extend: {
      priority: z.number().min(1).max(5),
      team: z.string().optional()
    },
    customValidation: (data) => {
      if (data.priority > 3 && !data.team) {
        return ['High priority agents must specify team'];
      }
      return [];
    }
  }
};

const linter = new CClint(customConfig);
const results = await linter.lintProject('./my-claude-project', {
  parallel: true,
  failOn: 'warning'
});
```

#### Individual Linter Usage
```typescript
import { AgentsLinter, CommandsLinter } from 'cclint';

// Lint only agents
const agentsLinter = new AgentsLinter();
const agentResults = await agentsLinter.lint('./project');

// Lint only commands  
const commandsLinter = new CommandsLinter();
const commandResults = await commandsLinter.lint('./project');
```


#### Build Tool Integration
```typescript
// Webpack plugin example
class CClintWebpackPlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('CClintWebpackPlugin', async (params, callback) => {
      try {
        const results = await lintProject(compiler.context, { 
          quiet: true,
          failOn: 'error'
        });
        
        if (results.hasErrors) {
          callback(new Error(`CCLint validation failed: ${results.errorCount} errors`));
          return;
        }
        
        callback();
      } catch (error) {
        callback(error);
      }
    });
  }
}
```

### CLI Experience (Unchanged)

The existing CLI interface remains completely unchanged:

```bash
# All existing CLI commands work exactly the same
npx cclint
npx cclint --format json
npx cclint --fail-on warning --verbose
```

## Testing Strategy

### Unit Tests

#### SDK Core Functions
```typescript
// src/lib/core.test.ts
describe('lintProject', () => {
  it('should return structured results for valid project', async () => {
    const results = await lintProject('./test-fixtures/valid-project');
    
    expect(results).toMatchObject({
      summary: expect.objectContaining({
        totalFiles: expect.any(Number),
        validFiles: expect.any(Number),
        errorCount: 0,
        warningCount: expect.any(Number)
      }),
      results: expect.arrayContaining([
        expect.objectContaining({
          file: expect.any(String),
          valid: expect.any(Boolean),
          errors: expect.any(Array),
          warnings: expect.any(Array)
        })
      ])
    });
  });

  it('should handle invalid project configuration gracefully', async () => {
    const results = await lintProject('./test-fixtures/invalid-project');
    
    expect(results.hasErrors).toBe(true);
    expect(results.errorCount).toBeGreaterThan(0);
    expect(results.results.some(r => !r.valid)).toBe(true);
  });
  
});
```

#### SDK Class Tests
```typescript
// src/lib/sdk.test.ts
describe('CClint SDK', () => {
  it('should lint individual file types', async () => {
    const linter = new CClint();
    
    const agentResults = await linter.lintAgents('./test-project');
    const commandResults = await linter.lintCommands('./test-project');
    
    expect(agentResults).toEqual(expect.any(Array));
    expect(commandResults).toEqual(expect.any(Array));
  });
  
  it('should use custom configuration', async () => {
    const customConfig = {
      agentSchema: {
        extend: {
          customField: z.string().optional()
        }
      }
    };
    
    const linter = new CClint(customConfig);
    const results = await linter.lintProject('./test-project');
    
    // Verify custom schema is applied
    expect(results).toBeDefined();
  });
});
```

### Integration Tests

#### CLI Compatibility Tests
```typescript
// Ensure CLI behavior unchanged
describe('CLI Compatibility', () => {
  it('should maintain exact CLI output format', async () => {
    const { stdout } = await execAsync('node dist/cli.js lint --format json');
    const cliResults = JSON.parse(stdout);
    
    // Compare with SDK results
    const sdkResults = await lintProject('.');
    
    expect(cliResults.summary).toEqual(sdkResults.summary);
  });
  
  it('should maintain CLI exit codes', async () => {
    // Test success case
    const { code: successCode } = await execAsync('node dist/cli.js lint', { 
      cwd: './test-fixtures/valid-project' 
    });
    expect(successCode).toBe(0);
    
    // Test failure case  
    const { code: failCode } = await execAsync('node dist/cli.js lint --fail-on error', {
      cwd: './test-fixtures/invalid-project',
      ignoreErrors: true
    });
    expect(failCode).toBe(1);
  });
});
```

#### Package Export Tests
```typescript
describe('Package Exports', () => {
  it('should export SDK as default', async () => {
    const CClint = await import('cclint');
    expect(CClint.default).toBeDefined();
    expect(new CClint.default()).toBeInstanceOf(CClint.CClint);
  });
  
  it('should export individual functions', async () => {
    const { lintProject, AgentsLinter, loadConfig } = await import('cclint');
    
    expect(typeof lintProject).toBe('function');
    expect(AgentsLinter).toBeDefined();
    expect(typeof loadConfig).toBe('function');
  });
  
  it('should export TypeScript types', () => {
    // This test validates TypeScript compilation
    const config: import('cclint').CclintConfig = {
      rules: { strict: true }
    };
    
    expect(config).toBeDefined();
  });
});
```

### End-to-End Tests

#### Real Project Integration
```typescript
describe('E2E SDK Usage', () => {
  it('should work with real Claude Code projects', async () => {
    // Test against actual .claude project structure
    const results = await lintProject('./test-fixtures/real-claude-project');
    
    expect(results.summary.totalFiles).toBeGreaterThan(0);
    expect(results.results).toHaveLength(results.summary.totalFiles);
  });
  
  it('should handle large projects efficiently', async () => {
    const start = Date.now();
    
    await lintProject('./test-fixtures/large-project', {
      parallel: true,
      concurrency: 5
    });
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000); // < 10 seconds
  });
});
```

### Mocking Strategies for External Dependencies

#### File System Mocking
```typescript
import { vol } from 'memfs';
import { jest } from '@jest/globals';

// Mock fs for predictable testing
jest.mock('fs', () => require('memfs').fs);
jest.mock('fs/promises', () => require('memfs').fs.promises);

beforeEach(() => {
  vol.reset();
  vol.fromJSON({
    '/test-project/.claude/agents/test-agent.md': `---
name: test-agent
description: Test agent
---
# Test Agent`,
    '/test-project/CLAUDE.md': '# Test Project',
  });
});
```


### Test Documentation
Each test includes purpose comments explaining validation goals:

```typescript
/**
 * Purpose: Validates that the SDK can handle malformed YAML frontmatter
 * without crashing and provides meaningful error messages.
 * 
 * Why: Frontmatter parsing failures are common user errors that should
 * be handled gracefully with clear feedback.
 */
it('should handle malformed YAML frontmatter gracefully', async () => {
  // Test implementation...
});
```

## Performance Considerations

### Impact Analysis

#### Memory Usage
- **SDK overhead**: Minimal - reuses existing object instances
- **Configuration caching**: Maintained from existing implementation  
- **Result streaming**: Large project results can be streamed vs. buffered
- **Parallel processing**: Existing concurrency controls preserved

#### CPU Performance  
- **Shared code paths**: CLI and SDK use identical linting logic
- **Process overhead eliminated**: No shell spawning for programmatic usage
- **Batch processing**: SDK can process multiple projects without restart overhead
- **Schema compilation caching**: Zod schemas compiled once, reused

#### I/O Optimization
- **File reading**: Existing file caching mechanisms preserved
- **Config loading**: Cached per project root (existing behavior)
- **Glob processing**: Existing parallel file discovery maintained

### Mitigation Strategies

#### Memory Management
- **SDK overhead**: Minimal - reuses existing object instances
- **Configuration caching**: Maintained from existing implementation  
- **Result handling**: Standard Promise-based results for all project sizes
- **Parallel processing**: Existing concurrency controls preserved

#### Performance Monitoring
- **Duration tracking**: Basic execution time measurement
- **Memory usage**: Standard Node.js memory monitoring
- **File processing**: Count of files processed per linter type

## Security Considerations

### Preserved Security Measures

#### Path Security (Critical)
- **All existing path validation preserved**: `sanitizePath()`, `isPathSafe()`
- **Path traversal prevention**: Real path resolution maintained
- **Symlink safety**: Existing protections unchanged
- **Working directory validation**: Project root validation preserved

#### Configuration Security
- **JavaScript config sandboxing**: 5-second timeout protection maintained
- **Code injection prevention**: Static analysis of JS configs preserved  
- **Function execution limits**: Custom validation timeouts preserved
- **Dangerous path detection**: System path protections maintained

#### Input Validation
- **Schema validation**: All Zod validations preserved and strengthened
- **Frontmatter safety**: YAML parsing protections maintained
- **File extension validation**: Existing file type restrictions preserved

### New Security Considerations

#### SDK Surface Area
```typescript
// Validate SDK inputs to prevent injection
export async function lintProject(
  projectRoot: string,
  options?: SDKLintOptions
): Promise<LintSummary> {
  // Validate project root path
  const safePath = sanitizePath(projectRoot);
  if (!isPathSafe(safePath)) {
    throw new PathSecurityError('Invalid project root path', safePath);
  }
  
  // Validate options object
  if (options && typeof options !== 'object') {
    throw new TypeError('Options must be an object');
  }
  
  // Proceed with validated inputs
}
```


### Security Testing
```typescript
// Security-focused tests
describe('SDK Security', () => {
  it('should reject path traversal attempts', async () => {
    await expect(lintProject('../../../etc')).rejects.toThrow(PathSecurityError);
    await expect(lintProject('/etc/passwd')).rejects.toThrow(PathSecurityError);
  });
  
});
```

## Documentation

### SDK Documentation (New)

#### Main README Updates
```markdown
## Installation & Usage

### CLI Usage
```bash
npm install -g cclint
cclint --format json
```

### SDK Usage  
```bash
npm install cclint
```

```javascript
import CClint from 'cclint';

const linter = new CClint();
const results = await linter.lintProject();
```

#### API Reference (`docs/api/README.md`)
- Complete SDK API documentation
- TypeScript type definitions
- Code examples for all functions
- Migration guide from CLI to SDK usage
- Custom reporter development guide

#### Integration Guides (`docs/integrations/`)
- **Webpack plugin**: `docs/integrations/webpack.md`
- **Vite plugin**: `docs/integrations/vite.md`
- **VS Code extension**: `docs/integrations/vscode.md`
- **GitHub Actions**: `docs/integrations/github-actions.md`
- **Jest integration**: `docs/integrations/jest.md`

### Updated Documentation

#### CLI Documentation  
- No changes required - all existing docs remain valid
- Add note about SDK availability for programmatic usage

#### Configuration Documentation
- Update custom schema examples to show SDK usage
- Add SDK-specific configuration options

#### Contributing Guide
- Add SDK development guidelines
- Update testing procedures for dual CLI/SDK testing
- Add performance testing guidelines

### TypeScript Documentation

#### Declaration Files
```typescript
// dist/index.d.ts - Generated TypeScript definitions
export declare class CClint {
  constructor(config?: CclintConfig);
  lintProject(projectRoot?: string, options?: SDKLintOptions): Promise<LintSummary>;
  // ... complete type definitions
}

export declare function lintProject(
  projectRoot: string,
  options?: SDKLintOptions,
  config?: CclintConfig  
): Promise<LintSummary>;

// Complete type exports
export {
  CclintConfig,
  SDKLintOptions,
  LintProgress,
  // ... all types
};
```

## Implementation Phases

### Phase 1: MVP/Core Functionality

#### Deliverables
- ✅ Extract core linting logic from CLI (`src/lib/core.ts`)
- ✅ Create basic SDK entry point (`src/index.ts`)
- ✅ Implement `CClint` class with core methods
- ✅ Update package.json exports for dual CLI/SDK
- ✅ Basic unit tests for core SDK functions
- ✅ CLI compatibility preserved and tested

#### Success Criteria
- All existing CLI tests pass unchanged
- Basic SDK import and usage works
- Core linting functions return structured data
- TypeScript definitions generated correctly
- Security measures preserved and tested

#### Timeline Estimate
*Note: Per specification guidelines, no time estimates included*

### Phase 2: Enhanced Features

#### Deliverables  
- ✅ Enhanced error handling and structured exceptions
- ✅ Performance monitoring and metrics collection
- ✅ Advanced filtering options (includeFiles/excludeFiles)
- ✅ Comprehensive integration tests
- ✅ Build tool integration examples

#### Success Criteria
- Error handling provides clear, actionable messages
- Performance metrics are collected and accurate
- File filtering works correctly with various patterns
- Integration tests cover real-world usage scenarios
- Build tool integrations work with popular bundlers

### Phase 3: Polish and Optimization

#### Deliverables
- ✅ Comprehensive API documentation
- ✅ Integration guides for popular tools (Webpack, Vite, etc.)
- ✅ Performance optimizations and benchmarking
- ✅ Advanced TypeScript type safety improvements
- ✅ Complete SDK test coverage (>95%)
- ✅ Production deployment preparation

#### Success Criteria
- Documentation is comprehensive and clear
- Integration examples work with real projects
- Performance meets or exceeds CLI performance
- Type safety is complete and helpful
- Test coverage meets project standards
- SDK is production-ready

## Open Questions

### Technical Decisions
1. **CommonJS vs ES Modules**: Should SDK prioritize CommonJS compatibility or embrace ES modules fully?
   - *Recommendation*: Support both via dual package.json exports
   - *Impact*: Build complexity vs. compatibility

2. **File Filtering Implementation**: Should filtering be done at the linter level or globally?
   - *Options*: Filter before passing to linters vs filter within each linter
   - *Recommendation*: Global filtering for efficiency and consistency

### API Design Questions
1. **Error Handling Strategy**: Throw exceptions vs return error objects?
   - *Current CLI*: Exit codes and console output
   - *SDK Options*: Exceptions (Node.js standard) vs Result<T, E> pattern
   - *Recommendation*: Exceptions for consistency with Node.js ecosystem

2. **Configuration Precedence**: How should SDK config override project config?
   - *Options*: Constructor config always wins vs merge strategy
   - *Recommendation*: Deep merge with constructor config taking precedence


### Integration Considerations
1. **Build Tool Integration**: Which integrations should be officially supported?
   - *Priority*: Webpack, Vite (most common)
   - *Secondary*: Rollup, esbuild, Parcel
   - *Community*: Jest, ESLint integration examples

2. **IDE Integration**: How should IDEs consume the SDK for real-time validation?
   - *Recommendation*: Provide examples and documentation for basic integration
   - *Future*: Consider Language Server Protocol support based on adoption

## References

### Related Issues and PRs
- *Note: No existing issues - this is a new feature specification*

### External Documentation
- [ESLint Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api) - Reference implementation pattern
- [Jest runCLI Documentation](https://jestjs.io/docs/cli) - Programmatic execution example
- [Prettier API](https://prettier.io/docs/en/api.html) - Simple programmatic API pattern
- [Zod Documentation](https://zod.dev/) - Schema validation patterns for SDK
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) - API design guidelines

### Relevant Design Patterns
- **Command Pattern**: CLI commands delegate to core SDK functions
- **Factory Pattern**: Creating linters and reporters dynamically
- **Observer Pattern**: Progress callbacks and event handling
- **Builder Pattern**: SDK configuration and option building
- **Strategy Pattern**: Multiple reporter implementations

### Architectural Decisions
- **Security-First**: All existing security measures preserved and enhanced
- **Backward Compatibility**: Zero breaking changes to CLI interface
- **Performance**: Shared code paths ensure no performance regression
- **Type Safety**: Complete TypeScript support for better developer experience
- **Extensibility**: Plugin architecture allows custom validation rules

---

*This specification follows the established patterns from successful tools like ESLint, Jest, and Prettier to provide both CLI convenience and SDK flexibility while maintaining CCLint's security-focused architecture.*