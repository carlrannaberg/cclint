# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/carlrannaberg/cclint/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/carlrannaberg/cclint/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/carlrannaberg/cclint/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/carlrannaberg/cclint/releases/tag/v0.1.0