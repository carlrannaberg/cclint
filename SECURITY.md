# Security Documentation for CClint Configuration System

## Overview

The CClint configuration system implements multiple layers of security to protect against code injection and arbitrary code execution attacks through malicious configuration files.

## Security Architecture

### 1. Configuration File Prioritization

CClint prioritizes safer configuration formats:

```
1. .cclintrc.json          (SAFE - JSON only)
2. cclint.config.json      (SAFE - JSON only)
3. cclint.config.js        (RESTRICTED - JavaScript with security checks)
4. cclint.config.mjs       (RESTRICTED - ES modules with security checks)
5. .cclintrc.js            (RESTRICTED - JavaScript with security checks)
6. .cclintrc.mjs           (RESTRICTED - ES modules with security checks)
```

**Recommendation: Always prefer JSON configuration files for maximum security.**

### 2. Path Traversal Protection

The system implements robust path validation:

- **Input Sanitization**: Rejects null bytes, empty strings, and obvious traversal patterns
- **Directory Boundary Enforcement**: Prevents access to system directories (`/etc`, `/usr`, `/sys`, etc.)
- **Symlink Validation**: Detects and rejects symbolic links that point outside the project directory
- **Real Path Resolution**: Uses `fs.realpath()` to resolve symbolic links and ensure files are within allowed boundaries

### 3. JavaScript Configuration Security

When loading JavaScript configuration files, multiple security layers are applied:

#### 3.1 Static Code Analysis
Before execution, the system scans for dangerous patterns:

```javascript
// DETECTED AND BLOCKED PATTERNS:
- require('child_process')
- require('fs')
- require('os') 
- import ... from 'child_process'
- process.exec()
- process.spawn()
- eval()
- Function()
- global.property = 
- globalThis.property =
- __proto__
- .constructor.
```

#### 3.2 Runtime Validation
After loading, configurations are validated for:

- **Dangerous Properties**: `__proto__`, `constructor`, `prototype`, `eval`, `Function`, `require`, `import`, `process`, `global`, `globalThis`, `window`
- **Prototype Pollution**: Detects modified prototypes that could indicate prototype pollution attacks
- **Unexpected Functions**: Only allows specific functions in designated contexts (e.g., `customValidation` functions)

#### 3.3 Execution Timeout
Function-based configuration exports are subject to a 5-second execution timeout to prevent hanging or infinite loops.

#### 3.4 Security Warnings
Clear warnings are displayed when JavaScript configurations are loaded:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  [SECURITY WARNING] Loading JavaScript configuration file:
   File: /path/to/cclint.config.js
   This will execute arbitrary JavaScript code from the file.
   Ensure this file is from a trusted source and has not been tampered with.
   Consider using JSON configuration files (.cclintrc.json) for better security.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Error Handling and Fail-Safe Behavior

- **Graceful Degradation**: Security violations result in configuration loading failure rather than crashes
- **Detailed Logging**: Security events are logged (when `CCLINT_VERBOSE=true`) for audit trails
- **Cache Poisoning Prevention**: Failed security validations are cached to prevent repeated execution attempts

## Configuration Options

### Disabling JavaScript Configuration Loading

For maximum security, JavaScript configuration loading can be disabled:

```javascript
import { loadConfig } from './config.js';

// Disable JS config loading - only JSON configs will be loaded
const config = await loadConfig(projectRoot, { allowJs: false });
```

### Environment Variables

- `CCLINT_VERBOSE=true` - Enables detailed security logging
- Node.js environment variables are also respected for underlying security

## Threat Model

### Protected Against

1. **Path Traversal Attacks**: Attempts to access files outside the project directory
2. **Code Injection**: Malicious JavaScript code in configuration files
3. **Prototype Pollution**: Attempts to modify JavaScript object prototypes
4. **System Command Execution**: Attempts to execute system commands via Node.js APIs
5. **Resource Exhaustion**: Infinite loops or long-running configuration functions
6. **Symlink Attacks**: Using symbolic links to access files outside allowed directories

### Limitations

1. **Trusted Environment Assumption**: The system assumes the Node.js environment itself is not compromised
2. **Dynamic Import Limitations**: Some sophisticated code obfuscation techniques might bypass static analysis
3. **File System Permissions**: Relies on operating system file permissions for additional security

## Best Practices

### For Users

1. **Use JSON Configuration**: Always prefer `.cclintrc.json` over JavaScript configurations
2. **Validate Sources**: Only use configuration files from trusted sources
3. **Regular Audits**: Periodically review configuration files for unexpected changes
4. **Principle of Least Privilege**: Run CClint with minimal necessary permissions
5. **Version Control**: Track configuration files in version control to detect unauthorized changes

### For Developers

1. **Security-First Design**: Prefer safe defaults and fail-safe behaviors
2. **Defense in Depth**: Implement multiple independent security layers
3. **Clear Warnings**: Provide clear security warnings for potentially dangerous operations
4. **Comprehensive Testing**: Include security-focused test cases for all threat scenarios
5. **Regular Security Reviews**: Periodically review and update security measures

## Security Testing

The system includes comprehensive security tests covering:

- Path traversal attempts
- Prototype pollution attacks
- Code injection scenarios
- Symlink-based attacks
- Configuration validation edge cases
- Timeout and resource exhaustion scenarios

Run security tests:
```bash
npm test src/lib/config.test.ts
```

## Reporting Security Issues

If you discover a security vulnerability in the CClint configuration system:

1. **Do not create a public GitHub issue**
2. Report privately to the maintainers
3. Include detailed reproduction steps
4. Allow time for assessment and patching before public disclosure

## Security Audit Log

- **2024-01**: Initial implementation with basic path validation
- **2024-01**: Added comprehensive static code analysis
- **2024-01**: Implemented prototype pollution detection
- **2024-01**: Added symlink validation and path traversal protection
- **2024-01**: Enhanced security warnings and error handling
- **2024-01**: Added comprehensive security test suite

## References

- [OWASP Code Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prototype Pollution Prevention](https://github.com/HoLyVieR/prototype-pollution-nsec18/blob/master/paper/JavaScript_prototype_pollution_attack_in_NodeJS.pdf)