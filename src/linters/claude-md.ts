import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseLinterImpl } from './base.js';
import { REQUIRED_CLAUDE_MD_SECTIONS, RECOMMENDED_CLAUDE_MD_SECTIONS } from '../lib/schemas.js';
import { detectProjectInfo } from '../lib/project-detection.js';
import type { LintResult, LintOptions, ClaudeMdStructure, CclintConfig, ProjectInfo } from '../types/index.js';

/**
 * Linter for CLAUDE.md files based on AGENTS.md template requirements
 */
export class ClaudeMdLinter extends BaseLinterImpl {
  name = 'claude-md';
  description = 'Lint CLAUDE.md file structure and content';

  async lint(projectRoot: string, options: LintOptions, projectInfo?: ProjectInfo): Promise<LintResult[]> {
    const results: LintResult[] = [];
    
    // Get project info with configuration (use passed projectInfo or detect)
    const info = projectInfo || await detectProjectInfo(projectRoot);
    
    // Look for CLAUDE.md or AGENTS.md in project root
    const possibleFiles = [
      path.join(projectRoot, 'CLAUDE.md'),
      path.join(projectRoot, 'AGENTS.md'),
    ];

    let foundFile = false;
    for (const filePath of possibleFiles) {
      try {
        await fs.stat(filePath);
        const result = await this.lintClaudeMdFile(filePath, info.cclintConfig);
        if (result) {
          results.push(result);
          foundFile = true;
        }
      } catch {
        // File doesn't exist
      }
    }

    // If no file found, suggest creating one
    if (!foundFile) {
      const result = this.createResult(path.join(projectRoot, 'CLAUDE.md'));
      this.addSuggestion(result, 
        'No CLAUDE.md or AGENTS.md found - consider creating one to document the project for AI assistants'
      );
      results.push(result);
    }

    return results;
  }

  private async lintClaudeMdFile(filePath: string, config?: CclintConfig): Promise<LintResult | null> {
    const result = this.createResult(filePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Analyze document structure
      const structure = this.analyzeStructure(content);
      
      // Validate structure
      this.validateStructure(structure, result, config);
      
      // Check content quality
      this.validateContent(content, result);
      
      // Check for AGENTS.md template compliance
      this.checkTemplateCompliance(content, structure, result);
      
      // Run custom validation if configured
      if (config?.claudeMdRules?.customValidation) {
        try {
          const customErrors = config.claudeMdRules.customValidation(content, structure.sections);
          for (const error of customErrors) {
            if (!result.customSchemaErrors) {
              result.customSchemaErrors = [];
            }
            result.customSchemaErrors.push(error);
            this.addError(result, `Custom validation: ${error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.addError(result, `Custom validation failed: ${errorMessage}`);
          if (process.env.CCLINT_VERBOSE) {
            console.error(`Custom validation error in ${this.name}:`, error);
          }
        }
      }

    } catch (error) {
      this.addError(result, `Failed to read file: ${error}`);
    }

    return result;
  }

  private analyzeStructure(content: string): ClaudeMdStructure {
    const lines = content.split('\n');
    const structure: ClaudeMdStructure = {
      hasTitle: false,
      hasDescription: false,
      hasNavigation: false,
      hasBuildSection: false,
      hasSubagentsSection: false,
      hasStyleSection: false,
      hasTestingSection: false,
      hasConfigSection: false,
      sections: [],
    };

    // Find all headings
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for main title
      if (trimmed.startsWith('# ') && !structure.hasTitle) {
        structure.hasTitle = true;
      }
      
      // Collect all section headings
      if (trimmed.startsWith('#')) {
        const heading = trimmed.replace(/^#+\s*/, '').toLowerCase();
        structure.sections.push(heading);
        
        // Check for specific required sections
        if (heading.includes('navigating') || heading.includes('codebase')) {
          structure.hasNavigation = true;
        }
        if (heading.includes('build') || heading.includes('command')) {
          structure.hasBuildSection = true;
        }
        if (heading.includes('subagent') || heading.includes('agent')) {
          structure.hasSubagentsSection = true;
        }
        if (heading.includes('style') || heading.includes('convention')) {
          structure.hasStyleSection = true;
        }
        if (heading.includes('test')) {
          structure.hasTestingSection = true;
        }
        if (heading.includes('config') || heading.includes('setting')) {
          structure.hasConfigSection = true;
        }
      }
    }

    // Check for description (content before first heading)
    const firstHeadingIndex = lines.findIndex(line => line.trim().startsWith('#'));
    if (firstHeadingIndex > 0) {
      const beforeFirstHeading = lines.slice(0, firstHeadingIndex).join('\n').trim();
      structure.hasDescription = beforeFirstHeading.length > 0;
    }

    return structure;
  }

  private validateStructure(structure: ClaudeMdStructure, result: LintResult, config?: CclintConfig): void {
    // Check for required elements
    if (!structure.hasTitle) {
      this.addError(result, 'Missing main title (# heading)');
    }

    if (!structure.hasDescription) {
      this.addWarning(result, 'Missing project description before first heading');
    }

    // Check for required sections (use custom config if available)
    const requiredSections = config?.claudeMdRules?.requiredSections || REQUIRED_CLAUDE_MD_SECTIONS;
    const missingSections: string[] = [];
    
    for (const required of requiredSections) {
      const found = structure.sections.some(section => 
        section.toLowerCase().includes(required.toLowerCase())
      );
      if (!found) {
        missingSections.push(required);
      }
    }
    
    // Legacy checks for backward compatibility (if using default sections)
    if (!config?.claudeMdRules?.requiredSections) {
      if (!structure.hasNavigation) {
        missingSections.push('Navigating the Codebase');
      }
      if (!structure.hasBuildSection) {
        missingSections.push('Build & Commands');
      }
      if (!structure.hasSubagentsSection) {
        missingSections.push('Using Subagents');
      }
      if (!structure.hasStyleSection) {
        missingSections.push('Code Style');
      }
      if (!structure.hasTestingSection) {
        missingSections.push('Testing');
      }
      if (!structure.hasConfigSection) {
        missingSections.push('Configuration');
      }
    }

    for (const section of missingSections) {
      this.addWarning(result, `Missing recommended section: ${section}`);
    }

    // Check for recommended sections
    const hasRecommendedSections = RECOMMENDED_CLAUDE_MD_SECTIONS.some(section => 
      structure.sections.some(s => s.includes(section.replace(/\s+/g, ' ').toLowerCase()))
    );

    if (!hasRecommendedSections) {
      this.addSuggestion(result, 'Consider adding recommended sections like "Git Commit Conventions" or "Architecture"');
    }
  }

  private validateContent(content: string, result: LintResult): void {
    // Check minimum content length
    if (content.length < 500) {
      this.addWarning(result, 'Document is quite short - consider adding more guidance for AI assistants');
    }

    // Check for common patterns from AGENTS.md template
    this.checkCommonPatterns(content, result);
    
    // Check for code examples
    this.checkCodeExamples(content, result);
    
    // Check for tool usage documentation
    this.checkToolUsage(content, result);
  }

  private checkCommonPatterns(content: string, result: LintResult): void {
    const patterns = [
      { pattern: /codebase-map/i, message: 'Mentions codebase navigation tools' },
      { pattern: /subagent/i, message: 'Documents subagent usage' },
      { pattern: /build|compile/i, message: 'Includes build instructions' },
      { pattern: /test/i, message: 'Covers testing guidelines' },
      { pattern: /commit|git/i, message: 'Includes git workflow guidance' },
    ];

    const foundPatterns = patterns.filter(p => p.pattern.test(content));
    
    if (foundPatterns.length < 3) {
      this.addSuggestion(result, 
        'Consider adding more project-specific guidance (build process, testing, git workflow, etc.)'
      );
    }
  }

  private checkCodeExamples(content: string, result: LintResult): void {
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    
    if (codeBlocks.length === 0) {
      this.addSuggestion(result, 'Consider adding code examples to illustrate usage patterns');
    } else if (codeBlocks.length < 3) {
      this.addSuggestion(result, 'Consider adding more code examples for better clarity');
    }
  }

  private checkToolUsage(content: string, result: LintResult): void {
    // Check for tool documentation patterns
    const toolPatterns = [
      /allowed-tools/i,
      /Task tool/i,
      /Bash tool/i,
      /Read tool/i,
      /Write tool/i,
    ];

    const hasToolDocumentation = toolPatterns.some(pattern => pattern.test(content));
    
    if (!hasToolDocumentation) {
      this.addSuggestion(result, 
        'Consider documenting tool usage patterns and restrictions for AI assistants'
      );
    }
  }

  private checkTemplateCompliance(
    content: string, 
    structure: ClaudeMdStructure, 
    result: LintResult
  ): void {
    // Check for AGENTS.md template-specific elements
    const templateElements = [
      { pattern: /This file provides guidance to AI/i, name: 'AI guidance statement' },
      { pattern: /When to Use/i, name: 'Usage guidance' },
      { pattern: /Examples/i, name: 'Examples section' },
      { pattern: /Security/i, name: 'Security considerations' },
    ];

    let foundElements = 0;
    for (const element of templateElements) {
      if (element.pattern.test(content)) {
        foundElements++;
      }
    }

    if (foundElements < 2) {
      this.addSuggestion(result, 
        'Consider following AGENTS.md template structure more closely for better AI assistant guidance'
      );
    }

    // Check for mandatory requirement patterns
    if (content.includes('MANDATORY REQUIREMENT') || content.includes('⚠️')) {
      // Good - has clear mandatory sections
    } else {
      this.addSuggestion(result, 
        'Consider adding clear mandatory requirements and warnings for AI assistants'
      );
    }

    // Check for subagent delegation patterns
    if (!content.includes('delegate') && !content.includes('subagent')) {
      this.addSuggestion(result, 
        'Consider documenting subagent delegation patterns for specialized tasks'
      );
    }
  }
}