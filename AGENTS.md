# AGENTS.md
This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, .windsurfrules, .replit.md, .github/copilot-instructions.md, and other AI config files are symlinks to AGENTS.md in this project.

# cclint (Claude Code Lint)

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

## Build & Commands

### Script Command Consistency
**Important**: When modifying npm scripts in package.json, ensure all references are updated:
- GitHub Actions workflows (.github/workflows/*.yml)
- README.md documentation
- Contributing guides
- Dockerfile/docker-compose.yml
- CI/CD configuration files
- Setup/installation scripts

Common places that reference npm scripts:
- Build commands → Check: workflows, README, Dockerfile
- Test commands → Check: workflows, contributing docs
- Lint commands → Check: pre-commit hooks, workflows
- Start commands → Check: README, deployment docs

**Note**: Always use the EXACT script names from package.json, not assumed names

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

### Testing Philosophy
**When tests fail, fix the code, not the test.**

Key principles:
- **Tests should be meaningful** - Avoid tests that always pass regardless of behavior
- **Test actual functionality** - Call the functions being tested, don't just check side effects
- **Failing tests are valuable** - They reveal bugs or missing features
- **Fix the root cause** - When a test fails, fix the underlying issue, don't hide the test
- **Test edge cases** - Tests that reveal limitations help improve the code
- **Document test purpose** - Each test should include a comment explaining why it exists and what it validates

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

## Directory Structure & File Organization

### Reports Directory
ALL project reports and documentation should be saved to the `reports/` directory:

```
cclint/
├── reports/              # All project reports and documentation
│   └── *.md             # Various report types
├── temp/                # Temporary files and debugging
└── [other directories]
```

### Report Generation Guidelines
**Important**: ALL reports should be saved to the `reports/` directory with descriptive names:

**Implementation Reports:**
- Phase validation: `PHASE_X_VALIDATION_REPORT.md`
- Implementation summaries: `IMPLEMENTATION_SUMMARY_[FEATURE].md`
- Feature completion: `FEATURE_[NAME]_REPORT.md`

**Testing & Analysis Reports:**
- Test results: `TEST_RESULTS_[DATE].md`
- Coverage reports: `COVERAGE_REPORT_[DATE].md`
- Performance analysis: `PERFORMANCE_ANALYSIS_[SCENARIO].md`
- Security scans: `SECURITY_SCAN_[DATE].md`

**Quality & Validation:**
- Code quality: `CODE_QUALITY_REPORT.md`
- Dependency analysis: `DEPENDENCY_REPORT.md`
- API compatibility: `API_COMPATIBILITY_REPORT.md`

**Report Naming Conventions:**
- Use descriptive names: `[TYPE]_[SCOPE]_[DATE].md`
- Include dates: `YYYY-MM-DD` format
- Group with prefixes: `TEST_`, `PERFORMANCE_`, `SECURITY_`
- Markdown format: All reports end in `.md`

### Temporary Files & Debugging
All temporary files, debugging scripts, and test artifacts should be organized in a `/temp` folder:

**Temporary File Organization:**
- **Debug scripts**: `temp/debug-*.js`, `temp/analyze-*.py`
- **Test artifacts**: `temp/test-results/`, `temp/coverage/`
- **Generated files**: `temp/generated/`, `temp/build-artifacts/`
- **Logs**: `temp/logs/debug.log`, `temp/logs/error.log`

**Guidelines:**
- Never commit files from `/temp` directory
- Use `/temp` for all debugging and analysis scripts created during development
- Clean up `/temp` directory regularly or use automated cleanup
- Include `/temp/` in `.gitignore` to prevent accidental commits

### Example `.gitignore` patterns
```
# Temporary files and debugging
/temp/
temp/
**/temp/
debug-*.js
test-*.py
analyze-*.sh
*-debug.*
*.debug

# Claude settings
.claude/settings.local.json

# Don't ignore reports directory
!reports/
!reports/**
```

### Claude Code Settings (.claude Directory)

The `.claude` directory contains Claude Code configuration files with specific version control rules:

#### Version Controlled Files (commit these):
- `.claude/settings.json` - Shared team settings for hooks, tools, and environment
- `.claude/commands/*.md` - Custom slash commands available to all team members
- `.claude/hooks/*.sh` - Hook scripts for automated validations and actions

#### Ignored Files (do NOT commit):
- `.claude/settings.local.json` - Personal preferences and local overrides
- Any `*.local.json` files - Personal configuration not meant for sharing

**Important Notes:**
- Claude Code automatically adds `.claude/settings.local.json` to `.gitignore`
- The shared `settings.json` should contain team-wide standards (linting, type checking, etc.)
- Personal preferences or experimental settings belong in `settings.local.json`
- Hook scripts in `.claude/hooks/` should be executable (`chmod +x`)

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

## Using Specialized Agents

### ⚠️ IMPORTANT: Always Delegate to Specialists

**When specialized agents are available, you MUST use them instead of attempting tasks yourself.**

Specialized agents provide deep expertise in specific domains. They have been trained on best practices, common pitfalls, and advanced patterns that general-purpose assistants might miss.

**Key Principles:**
- Always check if a specialized agent exists for your task domain
- Delegate complex technical problems to domain experts
- Use diagnostic agents first when the problem scope is unclear
- Leverage specialists for architecture decisions and optimizations

**Why This Matters:**
- Specialists have deeper, more focused knowledge
- They're aware of edge cases and subtle bugs
- They follow established patterns and best practices
- They can provide more comprehensive solutions

**Available Specialized Agents in `.claude/agents/`:**

### Build & Tools
- **`vite-expert.md`** - Vite build optimization, ESM-first development, HMR optimization
- **`webpack-expert.md`** - Webpack configuration, bundle analysis, code splitting
- **`typescript-build-expert.md`** - TypeScript compiler configuration and build optimization
- **`linting-expert.md`** - Code linting, formatting, and static analysis

### Code Quality & Review
- **`code-review-expert.md`** - Comprehensive code review covering architecture, quality, security
- **`refactoring-expert.md`** - Systematic code refactoring and code smell detection
- **`triage-expert.md`** - Context gathering and initial problem diagnosis

### Database & Backend
- **`database-expert.md`** - Database performance and schema design across multiple databases
- **`postgres-expert.md`** - PostgreSQL-specific query optimization and administration
- **`mongodb-expert.md`** - MongoDB document modeling and aggregation pipeline optimization
- **`nestjs-expert.md`** - Nest.js framework architecture and dependency injection

### DevOps & Infrastructure
- **`devops-expert.md`** - CI/CD pipelines, containerization, infrastructure as code
- **`docker-expert.md`** - Docker containerization and multi-stage builds
- **`github-actions-expert.md`** - GitHub Actions CI/CD pipeline optimization

### Frontend & UI
- **`react-expert.md`** - React component patterns, hooks, and state management
- **`react-performance-expert.md`** - React performance optimization and Core Web Vitals
- **`nextjs-expert.md`** - Next.js App Router, Server Components, and performance
- **`css-styling-expert.md`** - CSS architecture, responsive design, and design systems
- **`accessibility-expert.md`** - WCAG compliance and screen reader optimization

### Testing & Quality Assurance
- **`testing-expert.md`** - Cross-framework testing strategies and debugging
- **`jest-testing-expert.md`** - Jest framework and advanced mocking strategies
- **`vitest-expert.md`** - Vitest testing framework specifics
- **`playwright-expert.md`** - End-to-end testing and cross-browser automation

### TypeScript & Type Systems
- **`typescript-expert.md`** - General TypeScript development patterns
- **`typescript-type-expert.md`** - Advanced type system, generics, and conditional types

### Version Control & Documentation
- **`git-expert.md`** - Git workflow issues, merge conflicts, and repository management
- **`documentation-expert.md`** - Documentation structure, flow, and information architecture

### AI & Development Tools
- **`ai-sdk-expert.md`** - Vercel AI SDK integration and streaming patterns
- **`cli-expert.md`** - Building npm package CLIs with Unix philosophy

### Node.js & Backend
- **`nodejs-expert.md`** - Node.js runtime, async patterns, and performance optimization

**Discovering Available Agents:**
```bash
# List all available specialized agents
ls .claude/agents/

# Quick overview of agent capabilities
grep -r "description:" .claude/agents/ | head -10
```

**Usage Pattern:**
```
Use the Task tool with subagent_type: "[agent-name-without-md]"
```

For example:
- TypeScript issues: `subagent_type: "typescript-expert"`
- React performance: `subagent_type: "react-performance-expert"`
- Database optimization: `subagent_type: "postgres-expert"`

Remember: If a specialist exists for the task at hand, delegation is not optional—it's required for optimal results.

---

This project prioritizes security, comprehensive validation, and extensibility while maintaining high code quality standards. All AI assistants should follow these patterns and security requirements when contributing to the codebase.