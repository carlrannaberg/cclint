# cclint (Claude Code Lint)

A comprehensive linting tool for Claude Code projects that validates agent definitions, command configurations, settings files, and project documentation.

## Features

- **Agent/Subagent Linting**: Validates frontmatter, tools configuration, and naming conventions
- **Command Linting**: Checks slash command definitions and tool permissions
- **Settings Validation**: Validates `.claude/settings.json` hook configurations
- **Documentation Linting**: Ensures CLAUDE.md follows best practices and template structure
- **Custom Schema Support**: Extend base schemas with Zod for project-specific validation
- **Project Auto-Detection**: Automatically finds project root using directory climbing
- **Multiple Output Formats**: Console, JSON, and Markdown reports
- **CI/CD Friendly**: Configurable exit codes and quiet mode

## Installation

```bash
npm install -g cclint
```

## Usage

### Basic Linting

```bash
# Lint current project (auto-detects root)
cclint

# Lint specific directory
cclint --root /path/to/project

# Quiet mode (minimal output)
cclint --quiet

# Verbose mode (show all files)
cclint --verbose
```

### Report Generation

```bash
# Generate JSON report
cclint --format json --output lint-report.json

# Generate Markdown report
cclint --format markdown --output reports/lint-report.md
```

### CI/CD Integration

```bash
# Fail on errors only (default)
cclint --fail-on error

# Fail on warnings or errors
cclint --fail-on warning

# Fail on suggestions, warnings, or errors
cclint --fail-on suggestion

# Disable custom schema validation
cclint --no-custom-schemas
```

## What It Checks

### Agent/Subagent Files (*.md with frontmatter)

- ✅ Required fields: `name`, `description`
- ✅ Tool configurations and syntax
- ✅ Color validation (hex codes and CSS named colors)
- ✅ Naming conventions and filename matching
- ✅ Bundle field format validation
- ⚠️ Unknown tools and deprecated fields
- 💡 Missing displayName and content optimization

### Command Files (*.md with frontmatter)

- ✅ Frontmatter schema validation
- ✅ Tool permissions in `allowed-tools`
- ✅ Bash command usage validation
- ✅ File reference patterns
- ⚠️ Unknown tools and syntax errors
- 💡 Missing descriptions and argument hints

### Settings Files (.claude/settings.json)

- ✅ JSON syntax and schema validation
- ✅ Hook configuration structure
- ✅ Event types and matchers
- ✅ Command syntax validation
- ⚠️ Unknown hook events and tools
- 💡 Configuration optimization suggestions

### Documentation (CLAUDE.md/AGENTS.md)

- ✅ Required sections presence
- ✅ Document structure validation
- ✅ Template compliance checking
- ⚠️ Missing sections and content
- 💡 Content quality improvements

## Project Structure Detection

cclint automatically detects your project root by climbing up directories looking for:

- `.git` directory
- `package.json` file
- `.claude` directory

It then scans for files in common locations:

```
project-root/
├── .claude/
│   ├── settings.json     # Settings validation
│   ├── agents/           # Agent definitions
│   └── commands/         # Command definitions
├── src/
│   ├── agents/           # Alternative agent location
│   └── commands/         # Alternative command location
├── CLAUDE.md             # Documentation validation
└── AGENTS.md             # Alternative documentation
```

## Configuration

cclint works without configuration by using sensible defaults and auto-detection. For advanced usage, you can:

1. **Specify custom paths** with `--root`
2. **Control output verbosity** with `--quiet`/`--verbose`
3. **Choose output formats** with `--format`
4. **Set failure thresholds** with `--fail-on`
5. **Create custom schemas** with configuration files

### Custom Schema Configuration

cclint supports extending the base validation schemas with your own Zod schemas for project-specific requirements.

#### Configuration Files

cclint looks for configuration in the following files (in order of precedence):

- `cclint.config.js` - JavaScript configuration
- `cclint.config.mjs` - ES Module configuration  
- `cclint.config.ts` - TypeScript configuration (requires compilation)
- `.cclintrc.json` - JSON configuration
- `.cclintrc.js` - JavaScript configuration
- `.cclintrc.mjs` - ES Module configuration

#### JSON Configuration Example

```json
{
  "agentSchema": {
    "extend": {
      "priority": "number",
      "tags": "array",
      "experimental": "boolean"
    }
  },
  "commandSchema": {
    "extend": {
      "timeout": "number",
      "retryCount": "number"
    }
  },
  "rules": {
    "unknownFields": "warning",
    "strict": true,
    "excludePatterns": ["**/legacy/**"]
  }
}
```

#### JavaScript Configuration Example

```javascript
// cclint.config.js
import { z } from 'zod';

export default {
  agentSchema: {
    extend: {
      // Custom fields for agents
      priority: z.number().min(1).max(5).describe('Agent priority level'),
      tags: z.array(z.string()).optional().describe('Categorization tags'),
      experimental: z.boolean().optional().describe('Experimental feature flag'),
      owner: z.string().email().describe('Agent maintainer email')
    },
    customValidation: (data) => {
      const errors = [];
      
      // Custom validation logic
      if (data.experimental && !data.description?.includes('EXPERIMENTAL')) {
        errors.push('Experimental agents must include "EXPERIMENTAL" in description');
      }
      
      if (data.priority > 3 && !data.owner) {
        errors.push('High priority agents must have an owner assigned');
      }
      
      return errors;
    }
  },
  
  commandSchema: {
    extend: {
      timeout: z.number().positive().describe('Command timeout in milliseconds'),
      retryCount: z.number().min(0).max(3).default(0),
      async: z.boolean().optional().describe('Run command asynchronously')
    },
    customValidation: (data) => {
      const errors = [];
      
      if (data.async && !data.timeout) {
        errors.push('Async commands must specify a timeout');
      }
      
      return errors;
    }
  },
  
  settingsSchema: {
    extend: {
      // Custom settings fields
      customHooks: z.record(z.array(z.string())),
      teamSettings: z.object({
        lead: z.string(),
        members: z.array(z.string())
      }).optional()
    }
  },
  
  claudeMdRules: {
    requiredSections: [
      'project overview',
      'setup instructions', 
      'development workflow',
      'testing strategy'
    ],
    customValidation: (content, sections) => {
      const errors = [];
      
      if (!content.includes('## Security')) {
        errors.push('CLAUDE.md must include a Security section');
      }
      
      return errors;
    }
  },
  
  rules: {
    unknownFields: 'error',
    strict: true,
    includePatterns: ['custom-agents/**'],
    excludePatterns: ['**/legacy/**', '**/deprecated/**']
  }
};
```

#### TypeScript Configuration Example

```typescript
// cclint.config.ts
import { z } from 'zod';
import type { CclintConfig } from 'cclint';

const AgentPriority = z.enum(['low', 'medium', 'high', 'critical']);

const config: CclintConfig = {
  agentSchema: {
    extend: {
      priority: AgentPriority,
      team: z.string().min(1),
      version: z.string().regex(/^\d+\.\d+\.\d+$/)
    }
  }
};

export default config;
```

#### Schema Override Example

For complete control, you can override the entire schema:

```javascript
// cclint.config.js
import { z } from 'zod';

export default {
  agentSchema: {
    override: z.object({
      // Completely custom schema
      id: z.string().uuid(),
      name: z.string().min(1),
      version: z.string(),
      config: z.record(z.unknown())
    }).strict()
  }
};
```

#### Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `agentSchema.extend` | `Record<string, ZodType>` | Additional fields for agent frontmatter |
| `agentSchema.override` | `ZodType` | Complete replacement for agent schema |
| `agentSchema.customValidation` | `(data) => string[]` | Custom validation function |
| `commandSchema.*` | Same as agent | Custom command schema configuration |
| `settingsSchema.*` | Same as agent | Custom settings schema configuration |
| `claudeMdRules.requiredSections` | `string[]` | Required sections in CLAUDE.md |
| `claudeMdRules.recommendedSections` | `string[]` | Recommended sections |
| `claudeMdRules.customValidation` | `(content, sections) => string[]` | Custom validation |
| `rules.unknownFields` | `'error' \| 'warning' \| 'suggestion' \| 'ignore'` | How to handle unknown fields |
| `rules.strict` | `boolean` | Enable strict mode validation |
| `rules.includePatterns` | `string[]` | Additional file patterns to include |
| `rules.excludePatterns` | `string[]` | File patterns to exclude |

## Examples

### GitHub Actions Integration

```yaml
name: Claude Code Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install -g cclint
      - run: cclint --fail-on warning
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
cclint --quiet --fail-on error
```

### Report Generation Script

```bash
#!/bin/bash
# scripts/lint-report.sh
mkdir -p reports
cclint --format markdown --output reports/claude-lint-$(date +%Y%m%d).md
echo "Lint report generated in reports/"
```

## Exit Codes

- `0`: Success (no issues above failure threshold)
- `1`: Failure (issues found above failure threshold)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT

## Related Projects

- [claudekit](https://github.com/codeium/claudekit) - Toolkit for Claude Code development
- [Claude Code](https://claude.ai/code) - AI-powered coding assistant