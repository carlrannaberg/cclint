import { describe, it, expect } from 'vitest';
import { pathExists } from './project-detection.js';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('project-detection', () => {
  describe('pathExists', () => {
    it('should return true for existing files', async () => {
      // Use the current file as a test
      const currentFile = import.meta.url.replace('file://', '');
      const exists = await pathExists(currentFile);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const nonExistentPath = path.join(process.cwd(), 'this-file-does-not-exist.txt');
      const exists = await pathExists(nonExistentPath);
      expect(exists).toBe(false);
    });

    it('should return true for existing directories', async () => {
      const exists = await pathExists(process.cwd());
      expect(exists).toBe(true);
    });
  });
});