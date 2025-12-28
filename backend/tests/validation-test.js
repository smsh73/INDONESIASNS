import { 
  validateRequired, 
  validatePlatform, 
  validateKeywordType, 
  validatePriority,
  validateEmail,
  validateURL,
  validatePagination,
  validateDateRange,
  validateId,
  validateArray,
  validateStringLength,
  validateHashtag,
  validateKeyword
} from '../src/utils/validation.js';
import { AppError } from '../src/utils/errors.js';

console.log('🧪 검증 유틸리티 테스트 시작...\n');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
    errors.push(`${name}: ${error.message}`);
  }
}

// 1. validateRequired 테스트
console.log('=== 1. validateRequired 테스트 ===\n');
test('필수 필드 모두 존재', () => {
  validateRequired({ name: 'test', email: 'test@example.com' }, ['name', 'email']);
});

test('필수 필드 누락', () => {
  try {
    validateRequired({ name: 'test' }, ['name', 'email']);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 2. validatePlatform 테스트
console.log('\n=== 2. validatePlatform 테스트 ===\n');
test('유효한 플랫폼', () => {
  validatePlatform('instagram');
  validatePlatform('FACEBOOK');
  validatePlatform('LinkedIn');
});

test('유효하지 않은 플랫폼', () => {
  try {
    validatePlatform('invalid');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 3. validateKeywordType 테스트
console.log('\n=== 3. validateKeywordType 테스트 ===\n');
test('유효한 키워드 타입', () => {
  validateKeywordType('region');
  validateKeywordType('organization');
  validateKeywordType('person');
});

test('유효하지 않은 키워드 타입', () => {
  try {
    validateKeywordType('invalid');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 4. validatePriority 테스트
console.log('\n=== 4. validatePriority 테스트 ===\n');
test('유효한 우선순위', () => {
  validatePriority(0);
  validatePriority(50);
  validatePriority(100);
});

test('범위를 벗어난 우선순위', () => {
  try {
    validatePriority(101);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 5. validateEmail 테스트
console.log('\n=== 5. validateEmail 테스트 ===\n');
test('유효한 이메일', () => {
  validateEmail('test@example.com');
  validateEmail('user.name@domain.co.kr');
});

test('유효하지 않은 이메일', () => {
  try {
    validateEmail('invalid-email');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 6. validateURL 테스트
console.log('\n=== 6. validateURL 테스트 ===\n');
test('유효한 URL', () => {
  validateURL('https://example.com');
  validateURL('http://test.com/path');
});

test('유효하지 않은 URL', () => {
  try {
    validateURL('not-a-url');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 7. validatePagination 테스트
console.log('\n=== 7. validatePagination 테스트 ===\n');
test('유효한 페이지네이션', () => {
  const result = validatePagination(1, 20);
  if (result.page !== 1 || result.limit !== 20) throw new Error('잘못된 결과');
});

test('범위를 벗어난 페이지', () => {
  try {
    validatePagination(0, 20);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 8. validateDateRange 테스트
console.log('\n=== 8. validateDateRange 테스트 ===\n');
test('유효한 날짜 범위', () => {
  validateDateRange('2024-01-01', '2024-01-31');
});

test('시작 날짜가 종료 날짜보다 늦음', () => {
  try {
    validateDateRange('2024-01-31', '2024-01-01');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 9. validateId 테스트
console.log('\n=== 9. validateId 테스트 ===\n');
test('유효한 ID', () => {
  validateId(1);
  validateId(100);
});

test('유효하지 않은 ID', () => {
  try {
    validateId(0);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 10. validateArray 테스트
console.log('\n=== 10. validateArray 테스트 ===\n');
test('유효한 배열', () => {
  validateArray([1, 2, 3]);
  validateArray([1, 2, 3], 2);
});

test('최소 길이 미달', () => {
  try {
    validateArray([1], 2);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 11. validateStringLength 테스트
console.log('\n=== 11. validateStringLength 테스트 ===\n');
test('유효한 문자열 길이', () => {
  validateStringLength('test', 0, 10);
});

test('최대 길이 초과', () => {
  try {
    validateStringLength('this is too long', 0, 5);
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 12. validateHashtag 테스트
console.log('\n=== 12. validateHashtag 테스트 ===\n');
test('유효한 해시태그', () => {
  validateHashtag('#test');
  validateHashtag('test'); // # 자동 추가
});

test('유효하지 않은 해시태그', () => {
  try {
    validateHashtag('#test@invalid');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 13. validateKeyword 테스트
console.log('\n=== 13. validateKeyword 테스트 ===\n');
test('유효한 키워드', () => {
  validateKeyword('test keyword');
});

test('빈 키워드', () => {
  try {
    validateKeyword('');
    throw new Error('예외가 발생해야 함');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
});

// 결과 요약
console.log('\n=== 테스트 결과 요약 ===\n');
console.log(`✅ 통과: ${passed}개`);
console.log(`❌ 실패: ${failed}개`);
console.log(`총 테스트: ${passed + failed}개\n`);

if (errors.length > 0) {
  console.log('에러 목록:');
  errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error}`);
  });
  console.log('');
}

if (failed === 0) {
  console.log('🎉 모든 검증 테스트 통과!');
  process.exit(0);
} else {
  console.log('⚠️  일부 테스트 실패');
  process.exit(1);
}

