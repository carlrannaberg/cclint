# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.6] - 2025-08-28

### Added
- **Specialized CLI Commands**: New focused linting commands for specific file types
  - `cclint agents` - Lint only agent definition files
  - `cclint commands` - Lint only command definition files  
  - `cclint settings` - Lint only settings.json files
  - `cclint context` - Lint only CLAUDE.md context files
- **Professional Output**: All specialized commands now feature the same colored output, progress spinners, and professional summary formatting as the main command
- **Factory Pattern**: Clean, maintainable command creation with 30% code reduction

### Changed
- **Streamlined CLI**: Default behavior now directly lints everything without requiring explicit `lint` command
- **Improved User Experience**: Consistent professional interface across all commands with progress indicators and colored status messages

### Removed
- **Redundant Commands**: Removed unused `cclint init` and `cclint version` commands
- **Explicit Lint Command**: `cclint lint` no longer needed - `cclint` now directly performs full project linting

### Fixed
- **CLI Path Consistency**: Specialized SDK methods now use consistent path sanitization for security
- **Documentation**: Updated README and spec files to reflect new CLI structure

## [0.2.5] - 2025-08-28

### Added
- Comprehensive SDK integration tests for symlink behavior using mocked security
- End-to-end validation that `lintAgents()` and `lintCommands()` properly handle `followSymlinks` option
- Full test coverage for SDK surface area symlink consistency

## [0.2.4] - 2025-08-28

### Fixed
- **SDK Symlink Bug**: Fixed `lintAgents()` and `lintCommands()` methods not properly handling the `followSymlinks` option
  - The `normalizeOptions()` method was missing the `followSymlinks` mapping
  - Specialized SDK methods now correctly process symlinked files when `followSymlinks: true`
  - All SDK methods now have consistent symlink behavior

### Added
- Tests for SDK symlink option handling to prevent regression

## [0.2.3] - 2025-08-28

### Changed
- **BREAKING**: Aligned validation strictly with official Claude Code specifications
  - Removed `category` field from command frontmatter base schema
  - Removed `displayName` and `bundle` fields from agent frontmatter base schema
  - These fields are now only available through custom schema extensions
- Color validation now strictly enforces 8 official Claude Code colors only
- TypeScript interfaces updated to match official fields exactly

### Fixed
- README now accurately documents only official Claude Code fields
- Test data updated to use custom extensions for non-official fields
- Removed all references to unofficial fields from base validation logic

### Documentation
- Added clear documentation of official agent/subagent frontmatter fields
- Added clear documentation of official command frontmatter fields
- Updated README to explicitly state which fields are official vs. custom

## [0.2.2] - 2025-08-28

### Added
- Proper symlink support with security validation
  - New `--follow-symlinks` CLI option (secure by default, disabled)
  - `followSymlinks` option in SDK for programmatic control
  - Validates symlink targets remain within project root
  - Handles broken and circular symlinks gracefully
  - Comprehensive test coverage for symlink scenarios
- SDK documentation with return type explanations and use cases

### Fixed
- Symlink detection now uses `fs.lstat()` to properly identify symlinks
- Resolves both symlink target and project root for accurate path comparison (macOS /var -> /private/var issue)
- Wrapped symlink validation in try-catch to prevent breaking file discovery

### Security
- Symlinks are NOT followed by default for security
- When enabled, prevents path traversal attacks by validating targets
- Skips symlinks that escape project boundaries

## [0.2.1] - 2025-08-28

### Fixed
- File discovery now follows symlinks in `.claude` directories
  - Added `follow: true` option to glob pattern matching
  - Enables proper linting of symlinked agent and command files
  - Resolves issue where symlinked markdown files were not detected

## [0.2.0] - 2025-08-28

### Added
- **SDK and Programmatic API Support** - Complete dual CLI/SDK architecture
  - New `CClint` class for method-based programmatic usage
  - Exported core functions: `lintProject`, `lintFiles`, `loadProjectConfig`, `detectProject`
  - Individual linter methods: `lintAgents`, `lintCommands`, `lintSettings`, `lintClaudeMd`
  - Support for both class-based and function-based API patterns
  - TypeScript declarations for all exported APIs
  - Dual package exports in `package.json` for CLI and SDK usage
  - New types: `SDKLintOptions` and `EnhancedLintSummary` for SDK consumers
  - Comprehensive test coverage with 183 tests
- **Enhanced Validation**
  - Strict color validation limited to 8 official Claude Code colors: red, blue, green, yellow, purple, orange, pink, cyan
  - Updated model validation to specific enum values: sonnet, opus, haiku, sonnet[1m], opusplan, inherit
  - Support for both `tools` and `allowed-tools` fields in agent frontmatter
  - Array format support for tool declarations
- **Security Features**
  - Path sanitization for all user-provided paths
  - Timeout protection for custom validation functions
  - Sandboxed configuration loading for JavaScript config files
  - Protection against path traversal attacks
- **Performance Optimizations**
  - Parallel file processing with configurable concurrency
  - Efficient file discovery with glob patterns
  - Result caching for repeated validation runs

### Changed
- CLI now correctly outputs JSON format to stdout when `--format json` is specified
- Console reporter output is no longer mixed with JSON/Markdown formats
- Improved error messages with more descriptive context
- Updated package.json main entry to point to SDK index

### Fixed
- Config test file write bug that was creating malformed files (wrong parameter order in fs.writeFile)
- CLI JSON output not respecting the `--format` flag
- Test failures after schema validation updates
- Import cleanup removing unused functions and constants

### Removed
- Unused `validateColor` function from schemas
- `CSS_NAMED_COLORS` constant (214 colors) - now using strict 8-color validation
- Redundant validation code replaced by centralized schema validation

## [0.1.0] - 2025-08-23

### Added
- Initial release of cclint (Claude Code Lint)
- Agent file validation with YAML frontmatter parsing
- Command file validation
- Settings.json validation for Claude Code projects
- CLAUDE.md documentation structure validation
- Multiple output formats: console, JSON, markdown
- Auto-detection of project root via directory climbing
- Custom schema extension system
- Comprehensive test suite with Vitest
- CLI interface with Commander.js
- Security-focused path handling and input validation

[Unreleased]: https://github.com/carlrannaberg/cclint/compare/v0.2.6...HEAD
[0.2.6]: https://github.com/carlrannaberg/cclint/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/carlrannaberg/cclint/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/carlrannaberg/cclint/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/carlrannaberg/cclint/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/carlrannaberg/cclint/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/carlrannaberg/cclint/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/carlrannaberg/cclint/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/carlrannaberg/cclint/releases/tag/v0.1.0