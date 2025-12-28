# Azure Container Registry를 통한 배포 가이드

이 가이드는 Azure Container Registry (ACR)를 사용하여 App Service에 배포하는 방법을 설명합니다.

## 사전 요구사항

1. Azure CLI 설치 및 로그인
   ```bash
   az login
   ```

2. Docker 설치 (로컬 빌드 시)

3. PostgreSQL 클라이언트 (마이그레이션 실행 시)

## 빠른 배포

### 1. 배포 스크립트 실행

```bash
cd azure
./deploy-acr.sh
```

이 스크립트는 다음을 자동으로 수행합니다:
- ✅ Resource Group 생성
- ✅ Azure Container Registry 생성
- ✅ PostgreSQL 데이터베이스 생성
- ✅ Redis Cache 생성
- ✅ App Service Plan 생성
- ✅ Docker 이미지 빌드 및 ACR에 푸시
- ✅ 백엔드 App Service 생성 및 배포
- ✅ 프론트엔드 App Service 생성 및 배포
- ✅ 환경 변수 설정

### 2. OpenAI API Key 설정

```bash
./setup-openai-key.sh
```

또는 수동으로:
```bash
az webapp config appsettings set \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend \
  --settings OPENAI_API_KEY=your_openai_api_key
```

### 3. 데이터베이스 마이그레이션 실행

```bash
./migrate-database.sh
```

또는 수동으로:
```bash
# 비밀번호 확인
cat .postgres-password.txt

# 마이그레이션 실행
psql "postgresql://postgresadmin:<password>@indonesia-sns-postgres.postgres.database.azure.com:5432/indonesia_sns?sslmode=require" \
  -f ../database/migrations/001_initial_schema.sql

psql "postgresql://postgresadmin:<password>@indonesia-sns-postgres.postgres.database.azure.com:5432/indonesia_sns?sslmode=require" \
  -f ../database/migrations/002_admin_schema.sql
```

## 생성되는 리소스

### Resource Group
- **이름**: `indonesia-sns-rg`
- **위치**: `koreacentral`

### Azure Container Registry
- **이름**: `indonesiasnsacr`
- **SKU**: Basic
- **관리자 계정**: 활성화됨

### PostgreSQL Database
- **서버 이름**: `indonesia-sns-postgres`
- **데이터베이스**: `indonesia_sns`
- **사용자**: `postgresadmin`
- **비밀번호**: `.postgres-password.txt` 파일에 저장됨
- **SKU**: Standard_B1ms (Burstable)

### Redis Cache
- **이름**: `indonesia-sns-redis`
- **SKU**: Basic (c0)
- **비밀번호**: `.redis-password.txt` 파일에 저장됨

### App Service Plan
- **이름**: `indonesia-sns-plan`
- **SKU**: B1 (Linux)
- **위치**: `koreacentral`

### App Services
- **백엔드**: `indonesia-sns-backend.azurewebsites.net`
- **프론트엔드**: `indonesia-sns-frontend.azurewebsites.net`

## 애플리케이션 URL

배포 완료 후 다음 URL로 접근할 수 있습니다:

- **프론트엔드**: https://indonesia-sns-frontend.azurewebsites.net
- **백엔드 API**: https://indonesia-sns-backend.azurewebsites.net/api

## 환경 변수

### 백엔드 환경 변수
- `NODE_ENV`: production
- `PORT`: 8080
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `REDIS_URL`: Redis 연결 문자열
- `REDIS_PASSWORD`: Redis 비밀번호
- `JWT_SECRET`: 자동 생성됨
- `CORS_ORIGIN`: 프론트엔드 URL
- `AZURE_POSTGRES`: true
- `AZURE_REDIS`: true
- `OPENAI_API_KEY`: 수동 설정 필요

### 프론트엔드 환경 변수
- `REACT_APP_API_URL`: 백엔드 API URL

## 이미지 업데이트

코드 변경 후 이미지를 업데이트하려면:

```bash
cd azure
./deploy-acr.sh
```

스크립트가 자동으로:
1. 새 이미지를 빌드
2. ACR에 푸시
3. App Service를 재시작하여 새 이미지 사용

## 수동 이미지 업데이트

```bash
# 백엔드 이미지 빌드 및 푸시
az acr build \
  --registry indonesiasnsacr \
  --image indonesia-sns-backend:latest \
  --file docker/Dockerfile.backend \
  .

# 프론트엔드 이미지 빌드 및 푸시
az acr build \
  --registry indonesiasnsacr \
  --image indonesia-sns-frontend:latest \
  --file docker/Dockerfile.frontend \
  .

# App Service 재시작
az webapp restart --resource-group indonesia-sns-rg --name indonesia-sns-backend
az webapp restart --resource-group indonesia-sns-rg --name indonesia-sns-frontend
```

## 로그 확인

### 백엔드 로그
```bash
az webapp log tail \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend
```

### 프론트엔드 로그
```bash
az webapp log tail \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-frontend
```

## 비용 최적화

### 개발/테스트 환경
- App Service Plan: B1 (Basic)
- PostgreSQL: Standard_B1ms (Burstable)
- Redis: Basic (c0)
- ACR: Basic

### 프로덕션 환경 권장
- App Service Plan: S1 이상
- PostgreSQL: GeneralPurpose 계층
- Redis: Standard 이상
- ACR: Standard

## 문제 해결

### 배포 실패 시
1. Azure Portal에서 리소스 상태 확인
2. App Service 로그 확인
3. ACR 이미지 확인: `az acr repository list --name indonesiasnsacr`

### 데이터베이스 연결 실패
1. 방화벽 규칙 확인
2. 연결 문자열 확인
3. SSL 모드 확인 (Azure는 require)

### Redis 연결 실패
1. TLS 설정 확인
2. 비밀번호 확인
3. 포트 확인 (6380)

## 리소스 삭제

모든 리소스를 삭제하려면:

```bash
az group delete --name indonesia-sns-rg --yes --no-wait
```

⚠️ **주의**: 이 작업은 되돌릴 수 없습니다!

