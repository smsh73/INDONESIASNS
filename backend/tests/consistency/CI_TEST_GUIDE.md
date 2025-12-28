# CI/CD 정합성 테스트 가이드

## GitHub Actions 통합

### .github/workflows/consistency-tests.yml 예제

```yaml
name: Consistency Tests

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  consistency-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: indonesia_sns_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Setup test database
        run: |
          cd backend
          psql -U postgres -h localhost -c "CREATE DATABASE indonesia_sns_test;"
          psql -U postgres -h localhost -d indonesia_sns_test -f ../database/migrations/001_initial_schema.sql
          psql -U postgres -h localhost -d indonesia_sns_test -f ../database/migrations/002_admin_schema.sql
        env:
          PGPASSWORD: postgres
      
      - name: Run consistency tests
        run: |
          cd backend
          npm run test:consistency
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/indonesia_sns_test
          TEST_REDIS_URL: redis://localhost:6379/1
          JWT_SECRET: test-secret-key
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Azure DevOps 통합

### azure-pipelines.yml에 테스트 단계 추가

```yaml
- stage: Test
  displayName: 'Run Consistency Tests'
  jobs:
    - job: ConsistencyTests
      displayName: 'Consistency Tests'
      pool:
        vmImage: 'ubuntu-latest'
      
      services:
        postgres:
          image: postgres:15
          env:
            POSTGRES_PASSWORD: postgres
          ports:
            - 5432:5432
      
      steps:
        - task: NodeTool@0
          inputs:
            versionSpec: '18.x'
        
        - script: |
            cd backend
            npm ci
          displayName: 'Install dependencies'
        
        - script: |
            psql -U postgres -h localhost -c "CREATE DATABASE indonesia_sns_test;"
            psql -U postgres -h localhost -d indonesia_sns_test -f ../database/migrations/001_initial_schema.sql
            psql -U postgres -h localhost -d indonesia_sns_test -f ../database/migrations/002_admin_schema.sql
          displayName: 'Setup test database'
          env:
            PGPASSWORD: postgres
        
        - script: |
            cd backend
            npm run test:consistency
          displayName: 'Run tests'
          env:
            TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/indonesia_sns_test
            JWT_SECRET: test-secret-key
```

## 로컬 실행

### 사전 요구사항
- PostgreSQL 12+ 설치 및 실행
- Redis 설치 및 실행 (선택사항)
- Node.js 18+ 설치

### 실행 단계

1. 테스트 데이터베이스 생성:
```bash
createdb -U postgres indonesia_sns_test
```

2. 마이그레이션 실행:
```bash
psql -U postgres -d indonesia_sns_test -f database/migrations/001_initial_schema.sql
psql -U postgres -d indonesia_sns_test -f database/migrations/002_admin_schema.sql
```

3. 환경 변수 설정 (.env.test):
```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/indonesia_sns_test
TEST_REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-secret-key
```

4. 테스트 실행:
```bash
cd backend
npm run test:consistency
```

## 테스트 결과 해석

### 성공적인 실행
```
✅ PASS tests/consistency/database-schema.test.js
✅ PASS tests/consistency/data-integrity.test.js
✅ PASS tests/consistency/business-logic.test.js
✅ PASS tests/consistency/api-consistency.test.js
✅ PASS tests/consistency/data-consistency.test.js
✅ PASS tests/consistency/integration.test.js
✅ PASS tests/consistency/validation.test.js
✅ PASS tests/consistency/performance.test.js

Test Suites: 8 passed, 8 total
Tests:       88 passed, 88 total
```

### 실패 시 확인사항
1. 데이터베이스 연결 확인
2. 마이그레이션 완료 여부 확인
3. 환경 변수 설정 확인
4. 테스트 데이터베이스 상태 확인

## 커버리지 리포트

커버리지 리포트 생성:
```bash
npm run test:coverage
```

리포트 위치: `backend/coverage/index.html`

