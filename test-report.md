# Claude Code Lint Report

Generated on: 2025-08-22T19:47:42.108Z

## Summary

| Metric | Count |
|--------|-------|
| Files checked | 26 |
| Valid files | 24 |
| Errors | 1 |
| Warnings | 3 |
| Suggestions | 1 |
| Unused fields | 3 |
| Duration | 31ms |

**Status:** ❌ Failed with errors

## Detailed Results



















### `test-claude-project/.claude/commands/review.md`

**Errors:**

- ❌ Failed to parse file: YAMLException: end of the stream or a document separator is expected at line 4, column 33:
    argument-hint: [what to review] - e.g., "recent changes", "src/c ... 
                                    ^






### `test-claude-project/.claude/settings.json`

**Warnings:**

- ⚠️ Unrecognized field: env
- ⚠️ Unrecognized field: feedbackSurveyState
- ⚠️ Unrecognized field: statusLine

**Unused Fields:**

- env, feedbackSurveyState, statusLine

### `test-claude-project/CLAUDE.md`

**Suggestions:**

- 💡 No CLAUDE.md or AGENTS.md found - consider creating one to document the project for AI assistants

## Recommendations

### Priority: High (Errors)

Fix all errors before proceeding. Errors indicate invalid configurations that may cause issues.

### Priority: Medium (Warnings)

Address warnings to improve configuration quality and avoid potential issues.

### Priority: Low (Cleanup)

Remove unused fields to keep configurations clean and maintainable.

### Priority: Optional (Improvements)

Consider implementing suggestions to enhance your Claude Code setup.

### General Tips

- Keep configurations minimal and focused
- Document custom patterns and conventions
- Test configurations thoroughly
- Follow the AGENTS.md template for documentation