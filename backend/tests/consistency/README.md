# 정합성 테스트 상세 설명

## 테스트 카테고리

### 1. Database Schema Tests (`database-schema.test.js`)
데이터베이스 스키마의 구조적 정합성을 검증합니다.

**검증 항목:**
- ✅ 필수 테이블 존재 여부 (20개 테이블)
- ✅ Foreign Key 제약 조건 (6개 주요 관계)
- ✅ Check 제약 조건 (role, platform, sentiment, risk)
- ✅ Unique 제약 조건 (username, email, post_id, country name)
- ✅ 인덱스 존재 여부 (Foreign Key, 자주 조회되는 컬럼)
- ✅ 데이터 타입 일관성 (INTEGER, DECIMAL, UUID, TIMESTAMP)

### 2. Data Integrity Tests (`data-integrity.test.js`)
데이터 무결성 규칙이 올바르게 적용되는지 검증합니다.

**검증 항목:**
- ✅ Foreign Key 무결성 (잘못된 참조 방지)
- ✅ Check 제약 조건 검증 (유효하지 않은 값 방지)
- ✅ Unique 제약 조건 검증 (중복 데이터 방지)
- ✅ Cascade 삭제 동작 (관련 데이터 자동 삭제)
- ✅ Set NULL 동작 (선택적 참조의 NULL 처리)

### 3. Business Logic Tests (`business-logic.test.js`)
비즈니스 로직이 일관되게 작동하는지 검증합니다.

**검증 항목:**
- ✅ 포스트 수집 로직 (계정 관계 유지)
- ✅ 멘션 수집 로직 (포스트 관계 유지)
- ✅ 감정 분석 로직 (유효한 카테고리, 신뢰도 범위)
- ✅ 위험 분류 로직 (유효한 카테고리 및 수준)
- ✅ 위치 매핑 로직 (지역 정보 추출 및 저장)
- ✅ 데이터 집계 로직 (analytics_summary 일관성)
- ✅ 워크플로우 실행 로직 (실행 로그 유지)

### 4. API Consistency Tests (`api-consistency.test.js`)
API 엔드포인트의 일관성을 검증합니다.

**검증 항목:**
- ✅ 인증 일관성 (JWT 토큰 검증)
- ✅ 응답 구조 일관성 (success, data 필드)
- ✅ 권한 검증 (admin vs user)
- ✅ 에러 처리 일관성 (일관된 에러 형식)
- ✅ 쿼리 파라미터 처리 (pagination, filters)

### 5. Data Consistency Tests (`data-consistency.test.js`)
데이터의 일관성을 검증합니다.

**검증 항목:**
- ✅ 참조 무결성 (관계 유지)
- ✅ 데이터 타입 일관성 (숫자, 소수, 타임스탬프)
- ✅ 배열 타입 일관성 (hashtags, mentions)
- ✅ JSONB 타입 일관성 (metadata)
- ✅ 기본값 일관성 (default values)
- ✅ 제약 조건 검증 (NOT NULL, UNIQUE)
- ✅ Cascade 동작 (자동 삭제)
- ✅ 인덱스 사용 (쿼리 최적화)

### 6. Integration Tests (`integration.test.js`)
전체 워크플로우의 통합 정합성을 검증합니다.

**검증 항목:**
- ✅ End-to-End 데이터 흐름 (수집 → 분석 → 저장)
- ✅ 데이터 관계 일관성 (모든 관계 유지)
- ✅ 트랜잭션 일관성 (여러 작업의 원자성)

### 7. Validation Tests (`validation.test.js`)
데이터 검증의 정합성을 검증합니다.

**검증 항목:**
- ✅ 문자열 길이 제한
- ✅ 숫자 범위 검증
- ✅ Enum 값 검증
- ✅ 타임스탬프 검증
- ✅ 배열 타입 검증
- ✅ JSONB 검증

### 8. Performance Tests (`performance.test.js`)
성능 및 동시성 정합성을 검증합니다.

**검증 항목:**
- ✅ 쿼리 성능 (인덱스 사용)
- ✅ 동시 접근 처리
- ✅ 트랜잭션 격리
- ✅ 부하 하에서의 데이터 일관성

## 실행 방법

### 전체 정합성 테스트 실행
```bash
npm run test:consistency
```

### 개별 테스트 실행
```bash
# 스키마 테스트
npm test -- tests/consistency/database-schema.test.js

# 데이터 무결성 테스트
npm test -- tests/consistency/data-integrity.test.js

# 비즈니스 로직 테스트
npm test -- tests/consistency/business-logic.test.js

# API 일관성 테스트
npm test -- tests/consistency/api-consistency.test.js

# 데이터 일관성 테스트
npm test -- tests/consistency/data-consistency.test.js

# 통합 테스트
npm test -- tests/consistency/integration.test.js

# 검증 테스트
npm test -- tests/consistency/validation.test.js

# 성능 테스트
npm test -- tests/consistency/performance.test.js
```

### 커버리지 포함 실행
```bash
npm run test:coverage
```

## 테스트 결과 해석

### 성공적인 테스트
- ✅ 모든 테스트가 통과하면 시스템이 정합성 요구사항을 만족합니다
- 모든 제약 조건이 올바르게 작동합니다
- 데이터 무결성이 보장됩니다

### 실패한 테스트
- ❌ 실패한 테스트는 해당 영역의 정합성 문제를 나타냅니다
- 스키마 변경 후 반드시 테스트를 실행하세요
- Foreign Key나 제약 조건 변경 시 관련 테스트를 업데이트하세요

## 주의사항

1. **테스트 데이터베이스 사용**: 프로덕션 데이터베이스를 사용하지 마세요
2. **트랜잭션 격리**: 각 테스트는 트랜잭션을 사용하여 데이터를 격리합니다
3. **자동 롤백**: 테스트 후 자동으로 롤백되어 데이터베이스가 초기 상태로 복원됩니다
4. **환경 변수**: `.env.test` 파일을 올바르게 설정하세요
