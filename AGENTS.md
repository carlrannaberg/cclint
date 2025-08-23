# AGENTS.md - AI Assistant Guide

## Project Overview

**cclint** is a comprehensive linting tool specifically for **Claude Code** projects that validates agent definitions, command configurations, settings files, and project documentation against Claude Code's official specifications. 

**IMPORTANT**: All hardcoded validations (colors, tools, hook events, etc.) are strictly based on what Claude Code actually supports. Any project-specific extensions or custom values should be handled through the custom schema system, not by making the base validations more lenient.

### Key Features
- Agent/Subagent frontmatter and tool validation
- Command definition and permission checking  
- Settings.json hook configuration validation
- CLAUDE.md documentation structure validation
- Custom schema support with security sandboxing
- Auto-detection of project root via directory climbing
- Multiple output formats (console, JSON, markdown)
- CI/CD integration with configurable exit codes

## Build & Development Commands

### Essential Commands
```bash
# Build the project
npm run build

# Run tests (comprehensive test suite - 153+ tests)  
npm test

# Development watch mode
npm run dev

# Lint TypeScript code
npm run lint

# Format code with Prettier
npm run format

# Install CLI globally for testing
npm install -g .
```

### Testing Strategy
- **Framework**: Vitest 3.2.4 with comprehensive test coverage
- **Test Files**: `*.test.ts` in `src/` directory structure
- **Coverage**: 153+ tests covering all linter components
- **Security Testing**: Includes path traversal, code injection, and timeout protection tests
- **Integration Tests**: End-to-end CLI testing with real configuration files

### Quality Assurance
- **TypeScript**: Strict mode enabled, no `any` types allowed
- **ESLint**: @typescript-eslint rules for code quality
- **Prettier**: Consistent code formatting
- **Vitest**: Comprehensive unit and integration testing
- **Security**: Path sanitization and code execution protection

## Architecture & Code Style

### Project Structure
```
src/
├── cli.ts              # Main CLI entry point with Commander.js
├── lib/
│   ├── config.ts       # Secure configuration loading with sandboxing
│   ├── utils.ts        # Utilities with path sanitization
│   └── file-scanner.ts # Parallel file discovery with glob patterns
├── linters/
│   ├── base.ts         # Base linter class with shared functionality
│   ├── agents.ts       # Agent/subagent frontmatter validation
│   ├── commands.ts     # Command definition validation
│   ├── settings.ts     # Settings.json hook validation
│   └── claude-md.ts    # Documentation structure validation
├── schemas/
│   └── index.ts        # Zod schemas for all file types
└── types/
    └── index.ts        # TypeScript type definitions
```

### Code Conventions

**TypeScript Standards**:
- Strict mode enabled (`"strict": true`)
- No `any` types - use proper typing
- Prefer interfaces for object shapes
- Use `readonly` for immutable arrays/objects
- Export types separately from implementations

**Security Requirements**:
- Always validate user input paths with `sanitizePath()`
- Never use dynamic `eval()` or `Function()` constructors
- Timeout protection for user-provided code execution
- Validate all external configuration inputs
- Use `path.resolve()` and `fs.realpath()` for path safety

**Error Handling**:
- Use custom error classes (e.g., `PathSecurityError`)
- Provide descriptive error messages with context
- Handle async operations with proper try/catch
- Log security issues conditionally with `CCLINT_VERBOSE`

**Testing Patterns**:
- Test files mirror source structure (`*.test.ts`)
- Use descriptive test names explaining the scenario
- Include both positive and negative test cases
- Test security vulnerabilities and edge cases
- Mock file system operations appropriately

### Dependencies & Technology Stack

**Core Dependencies**:
- `zod@^3.22.4` - Schema validation with custom extensions
- `commander@^11.1.0` - CLI argument parsing and commands
- `chalk@^5.3.0` - Terminal color output
- `gray-matter@^4.0.3` - YAML frontmatter parsing
- `glob@^10.3.10` - File pattern matching
- `ora@^8.0.1` - CLI spinner and progress indicators

**Development Dependencies**:
- `typescript@^5.3.0` - TypeScript compiler
- `vitest@^3.2.4` - Testing framework
- `eslint@^8.55.0` + `@typescript-eslint/*` - Linting
- `prettier@^3.1.0` - Code formatting

## Linting & Validation Focus

### What cclint Validates

**Agent Files** (`*.md` with frontmatter):
- Required fields: `name`, `description`
- Tool configurations and permissions
- Color validation (hex codes, CSS named colors)
- Bundle format and naming conventions
- Unknown tools and deprecated field warnings

**Command Files** (`*.md` with frontmatter):
- Frontmatter schema compliance
- Tool permissions in `allowed-tools`
- Bash command syntax and usage
- File reference patterns and security

**Settings Files** (`.claude/settings.json`):
- JSON syntax and schema validation
- Hook configuration structure
- Event types and matchers
- Command syntax and tool permissions

**Documentation** (`CLAUDE.md`/`AGENTS.md`):
- Required sections presence
- Template compliance
- Content structure and quality

### Custom Schema System

cclint supports extending base schemas with project-specific validation:

```javascript
// cclint.config.js
export default {
  agentSchema: {
    extend: {
      priority: z.number().min(1).max(5),
      team: z.string().min(1),
      experimental: z.boolean().optional()
    },
    customValidation: (data) => {
      const errors = [];
      if (data.experimental && !data.description?.includes('EXPERIMENTAL')) {
        errors.push('Experimental agents must include "EXPERIMENTAL" in description');
      }
      return errors;
    }
  }
};
```

## Common Tasks & Patterns

### Adding New Linters
1. Create new linter class extending `BaseLinter`
2. Implement `validateFile()` method with proper error handling
3. Add corresponding Zod schema in `schemas/index.ts`
4. Create comprehensive test suite in `*.test.ts`
5. Update CLI to register the new linter

### Security Considerations
- Always use `sanitizePath()` for user-provided paths
- Validate configuration files before dynamic imports
- Use timeouts for user-provided validation functions
- Never trust external input without validation
- Log security events with appropriate detail levels

### Performance Optimization
- Use parallel processing for file operations
- Implement configurable concurrency limits
- Cache resolved paths and validation results where safe
- Use efficient glob patterns for file discovery

## Development Workflow

### Before Starting Work
1. Run `npm test` to ensure all tests pass
2. Check `npm run lint` for code style issues
3. Review recent commits for context

### During Development
1. Write tests first for new functionality (TDD)
2. Use `npm run dev` for continuous compilation
3. Test security implications of any user input handling
4. Follow existing patterns in the codebase

### Before Committing
1. Run full test suite: `npm test`
2. Lint and format: `npm run lint && npm run format`
3. Build successfully: `npm run build`
4. Test CLI locally with: `npm install -g . && cclint`

### Commit Convention
Follow Conventional Commits format as specified in CLAUDE.md:
- `feat: add new validation rule`
- `fix: resolve path traversal vulnerability`
- `docs: update schema documentation`
- `test: add security test cases`

## Key Files to Understand

### Security-Critical Files
- `src/lib/utils.ts` - Path sanitization and security utilities
- `src/lib/config.ts` - Configuration loading with sandboxing
- `src/linters/base.ts` - Shared validation patterns

### Core Logic Files
- `src/cli.ts` - CLI interface and command orchestration
- `src/schemas/index.ts` - All validation schemas
- `src/types/index.ts` - TypeScript definitions

### Test Files
- `src/**/*.test.ts` - Comprehensive test coverage
- `test-claude-project/` - Test fixtures and sample configurations

## Troubleshooting

### Common Issues
- **Path errors**: Check `sanitizePath()` usage and permissions
- **Schema validation failures**: Verify Zod schema definitions
- **Test failures**: Ensure test data matches current schemas
- **Build errors**: Check TypeScript strict mode compliance

### Debug Mode
Set `CCLINT_VERBOSE=1` to enable detailed logging for security events and validation processes.

### Known Limitations
- Custom schema validation functions must not access external resources
- Path traversal protection requires proper `allowedBasePath` configuration
- Dynamic configuration loading has 5-second timeout protection

---

This project prioritizes security, comprehensive validation, and extensibility while maintaining high code quality standards. All AI assistants should follow these patterns and security requirements when contributing to the codebase.