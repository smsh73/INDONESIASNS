#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  'database-schema.test.js',
  'data-integrity.test.js',
  'business-logic.test.js',
  'api-consistency.test.js',
  'data-consistency.test.js',
];

console.log('🧪 Running all consistency tests...\n');

let passed = 0;
let failed = 0;
const results = [];

for (const testFile of testFiles) {
  const testPath = join(__dirname, testFile);
  console.log(`Running: ${testFile}...`);
  
  try {
    execSync(`npx jest ${testPath} --config jest.config.js`, {
      stdio: 'inherit',
      cwd: join(__dirname, '../..'),
    });
    passed++;
    results.push({ file: testFile, status: 'PASSED' });
    console.log(`✅ ${testFile} PASSED\n`);
  } catch (error) {
    failed++;
    results.push({ file: testFile, status: 'FAILED' });
    console.log(`❌ ${testFile} FAILED\n`);
  }
}

console.log('\n📊 Test Summary:');
console.log('================');
results.forEach((result) => {
  const icon = result.status === 'PASSED' ? '✅' : '❌';
  console.log(`${icon} ${result.file}: ${result.status}`);
});
console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

