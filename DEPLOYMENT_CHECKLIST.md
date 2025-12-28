# 배포 체크리스트

## 현재 상태

### ✅ 완료된 작업
1. 코드 수정 완료
   - `backend/src/services/monitoring/monitoringService.js` (2025-12-28 11:06 수정)
   - 키워드/해시태그 조회 개선
   - 매칭 함수 개선
   - 입력 검증 강화

2. 테스트 파일 생성 완료
   - `backend/tests/keyword-monitoring-collection-test.js`
   - `backend/tests/comprehensive-test.js`
   - `backend/tests/api-integration-test.js`
   - `backend/tests/data-quality-test.js`
   - `azure/test-keyword-monitoring-collection.sh`

### ❌ 미완료 작업

#### 1. 테스트 실행
- [ ] 키워드/모니터링/수집 집중 테스트 실행
- [ ] 포괄적 기능 테스트 실행
- [ ] API 통합 테스트 실행
- [ ] 데이터 품질 테스트 실행
- [ ] SQL 기반 테스트 실행

#### 2. 배포
- [ ] 백엔드 배포 (`./azure/deploy-backend.sh`)
- [ ] 배포 후 검증

## 다음 단계

### 1단계: 테스트 실행
```bash
# 전체 테스트 실행
./azure/run-all-tests.sh

# 또는 개별 실행
cd backend && node tests/keyword-monitoring-collection-test.js
cd backend && node tests/comprehensive-test.js
cd backend && node tests/api-integration-test.js
cd backend && node tests/data-quality-test.js
```

### 2단계: 배포 실행
```bash
# 백엔드 배포
./azure/deploy-backend.sh
```

### 3단계: 배포 후 검증
```bash
# 배포 상태 확인
./azure/check-deployment.sh

# API 엔드포인트 테스트
curl https://indonesia-sns-backend.azurewebsites.net/api/health
```

