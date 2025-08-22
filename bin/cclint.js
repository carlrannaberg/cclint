#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and run the CLI
import(join(__dirname, '../dist/cli.js')).then(module => {
  module.main();
}).catch(error => {
  console.error('Failed to start cclint:', error);
  process.exit(1);
});