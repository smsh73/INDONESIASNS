# 정합성 테스트 (Consistency Tests)

이 디렉토리에는 시스템의 정합성을 검증하는 테스트들이 포함되어 있습니다.

## 테스트 구조

### 1. database-schema.test.js
데이터베이스 스키마의 정합성을 검증합니다:
- 테이블 존재 여부
- Foreign Key 제약 조건
- Check 제약 조건
- Unique 제약 조건
- 인덱스 존재 여부
- 데이터 타입 일관성

### 2. data-integrity.test.js
데이터 무결성을 검증합니다:
- Foreign Key 무결성
- Check 제약 조건 검증
- Unique 제약 조건 검증
- Cascade 삭제 동작
- 데이터 일관성

### 3. business-logic.test.js
비즈니스 로직의 정합성을 검증합니다:
- 포스트 수집 로직
- 멘션 수집 로직
- 감정 분석 로직
- 위험 분류 로직
- 위치 매핑 로직
- 데이터 집계 로직
- 워크플로우 실행 로직

### 4. api-consistency.test.js
API 엔드포인트의 정합성을 검증합니다:
- 인증 일관성
- 응답 구조 일관성
- 권한 검증
- 에러 처리 일관성
- 쿼리 파라미터 처리

### 5. data-consistency.test.js
데이터 일관성을 검증합니다:
- 참조 무결성
- 데이터 타입 일관성
- 기본값 일관성
- 제약 조건 검증
- Cascade 동작
- 인덱스 사용

## 실행 방법

### 개별 테스트 실행
```bash
npm test -- tests/consistency/database-schema.test.js
```

### 모든 정합성 테스트 실행
```bash
npm run test:consistency
```

### 특정 카테고리 테스트 실행
```bash
# 검증 테스트
npm test -- tests/consistency/validation.test.js

# 성능 테스트
npm test -- tests/consistency/performance.test.js

# 통합 테스트
npm test -- tests/consistency/integration.test.js

### 전체 테스트 실행
```bash
npm test
```

## 환경 설정

테스트를 실행하기 전에 `.env.test` 파일을 생성하고 다음 변수를 설정하세요:

```
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/indonesia_sns_test
TEST_REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
```

## 테스트 데이터베이스 설정

테스트용 데이터베이스를 생성하고 마이그레이션을 실행하세요:

```bash
createdb indonesia_sns_test
psql -U postgres -d indonesia_sns_test < database/migrations/001_initial_schema.sql
psql -U postgres -d indonesia_sns_test < database/migrations/002_admin_schema.sql
```

## 주의사항

- 테스트는 트랜잭션을 사용하여 데이터를 격리합니다
- 각 테스트 후 롤백하여 데이터베이스를 초기 상태로 복원합니다
- 프로덕션 데이터베이스를 사용하지 마세요

