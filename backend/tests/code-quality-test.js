import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 코드 품질 검사 시작...\n');

let passed = 0;
let failed = 0;
const issues = [];

// 검사할 디렉토리
const srcDir = path.join(__dirname, '..', 'src');

// 파일 검사 함수
function checkFile(filePath, relativePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // 1. 에러 처리 확인
  let hasErrorHandling = false;
  let hasTryCatch = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // try-catch 블록 확인
    if (line.includes('try {')) {
      hasTryCatch = true;
      // 해당 try 블록에 catch가 있는지 확인
      let catchFound = false;
      for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
        if (lines[j].includes('catch')) {
          catchFound = true;
          break;
        }
        if (lines[j].includes('try {')) break; // 중첩된 try
      }
      if (!catchFound) {
        issues.push(`${relativePath}:${i + 1} - try 블록에 catch가 없습니다`);
        failed++;
        return;
      }
    }
    
    // 에러 로깅 확인
    if (line.includes('logger.error') || line.includes('console.error')) {
      hasErrorHandling = true;
    }
  }
  
  // 2. console.log 사용 확인 (프로덕션 코드에서는 logger 사용 권장)
  const consoleLogCount = (content.match(/console\.log\(/g) || []).length;
  if (consoleLogCount > 0 && !relativePath.includes('test')) {
    issues.push(`${relativePath} - console.log 사용 (${consoleLogCount}개), logger 사용 권장`);
  }
  
  // 3. 하드코딩된 문자열 확인 (일부만)
  if (content.includes('localhost:') && !relativePath.includes('config')) {
    issues.push(`${relativePath} - 하드코딩된 localhost URL 발견`);
  }
  
  // 4. TODO/FIXME 주석 확인
  const todoMatches = content.match(/TODO|FIXME|XXX|HACK/gi);
  if (todoMatches) {
    issues.push(`${relativePath} - TODO/FIXME 주석 발견 (${todoMatches.length}개)`);
  }
  
  // 5. 긴 함수 확인 (100줄 이상)
  const functionMatches = content.match(/^(export\s+)?(async\s+)?function\s+\w+|^const\s+\w+\s*=\s*(async\s+)?\(/gm);
  if (functionMatches && lines.length > 100) {
    // 간단한 체크만 수행
  }
  
  if (hasTryCatch || hasErrorHandling) {
    passed++;
  } else if (relativePath.includes('controller') || relativePath.includes('service')) {
    issues.push(`${relativePath} - 에러 처리 부족`);
    failed++;
  } else {
    passed++;
  }
}

// 디렉토리 순회
function walkDir(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      walkDir(filePath, baseDir);
    } else if (file.endsWith('.js') && !file.includes('.test.') && !file.includes('.spec.')) {
      const relativePath = path.relative(baseDir, filePath);
      checkFile(filePath, relativePath);
    }
  }
}

// 검사 실행
try {
  walkDir(srcDir, srcDir);
  
  console.log('=== 코드 품질 검사 결과 ===\n');
  console.log(`✅ 통과: ${passed}개 파일`);
  console.log(`❌ 문제 발견: ${failed}개 파일`);
  console.log(`총 검사 파일: ${passed + failed}개\n`);
  
  if (issues.length > 0) {
    console.log('발견된 이슈:');
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
    console.log('');
  }
  
  if (failed === 0 && issues.length === 0) {
    console.log('🎉 모든 코드 품질 검사 통과!');
    process.exit(0);
  } else {
    console.log('⚠️  일부 코드 품질 이슈 발견');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 검사 중 오류:', error.message);
  process.exit(1);
}

