# Azure 배포 가이드

인도네시아 검찰청 SNS 분석 AI 포털을 Microsoft Azure에 배포하는 가이드입니다.

## 필수 사항

- Azure 구독
- Azure CLI 설치 및 로그인
- Node.js 18 이상
- PostgreSQL 클라이언트 (선택사항)

## Azure 서비스 구성

### 1. 리소스 그룹 생성

```bash
az group create --name indonesia-sns-rg --location koreacentral
```

### 2. PostgreSQL 데이터베이스 생성

```bash
az postgres flexible-server create \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-postgres \
  --location koreacentral \
  --admin-user postgresadmin \
  --admin-password <강력한_비밀번호> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32

az postgres flexible-server db create \
  --resource-group indonesia-sns-rg \
  --server-name indonesia-sns-postgres \
  --database-name indonesia_sns
```

### 3. Redis Cache 생성

```bash
az redis create \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-redis \
  --location koreacentral \
  --sku Basic \
  --vm-size c0
```

### 4. App Service Plan 생성

```bash
az appservice plan create \
  --name indonesia-sns-plan \
  --resource-group indonesia-sns-rg \
  --location koreacentral \
  --is-linux \
  --sku B1
```

### 5. 백엔드 App Service 생성

```bash
az webapp create \
  --resource-group indonesia-sns-rg \
  --plan indonesia-sns-plan \
  --name indonesia-sns-backend \
  --runtime "NODE:18-lts"
```

### 6. 프론트엔드 App Service 생성

```bash
az webapp create \
  --resource-group indonesia-sns-rg \
  --plan indonesia-sns-plan \
  --name indonesia-sns-frontend \
  --runtime "NODE:18-lts"
```

## 환경 변수 설정

### 백엔드 환경 변수

```bash
az webapp config appsettings set \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="postgresql://postgresadmin:<비밀번호>@indonesia-sns-postgres.postgres.database.azure.com:5432/indonesia_sns?sslmode=require" \
    REDIS_URL="indonesia-sns-redis.redis.cache.windows.net:6380" \
    REDIS_PASSWORD="<Redis_비밀번호>" \
    JWT_SECRET="<JWT_시크릿>" \
    OPENAI_API_KEY="<OpenAI_API_키>" \
    CORS_ORIGIN="https://indonesia-sns-frontend.azurewebsites.net" \
    AZURE_POSTGRES=true \
    AZURE_REDIS=true
```

### 프론트엔드 환경 변수

```bash
az webapp config appsettings set \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-frontend \
  --settings \
    REACT_APP_API_URL="https://indonesia-sns-backend.azurewebsites.net/api" \
    REACT_APP_WS_URL="https://indonesia-sns-backend.azurewebsites.net"
```

## 배포

### 방법 1: Azure CLI를 사용한 배포

```bash
# 백엔드 배포
cd backend
zip -r ../backend.zip . -x "node_modules/*" ".git/*"
az webapp deployment source config-zip \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend \
  --src ../backend.zip

# 프론트엔드 빌드 및 배포
cd ../frontend
npm install
npm run build
cd build
zip -r ../../frontend.zip .
az webapp deployment source config-zip \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-frontend \
  --src ../../frontend.zip
```

### 방법 2: 자동화 스크립트 사용

```bash
chmod +x azure/deploy.sh
./azure/deploy.sh indonesia-sns-rg koreacentral
```

### 방법 3: Azure DevOps 파이프라인

1. Azure DevOps 프로젝트 생성
2. `azure/azure-pipelines.yml` 파일 사용
3. Azure Service Connection 설정
4. 파이프라인 실행

## 데이터베이스 마이그레이션

Azure PostgreSQL에 연결하여 마이그레이션 실행:

```bash
psql "postgresql://postgresadmin:<비밀번호>@indonesia-sns-postgres.postgres.database.azure.com:5432/indonesia_sns?sslmode=require" \
  -f database/migrations/001_initial_schema.sql
```

## Azure Key Vault 통합 (선택사항)

민감한 정보를 Key Vault에 저장:

```bash
# Key Vault 생성
az keyvault create \
  --name indonesia-sns-kv \
  --resource-group indonesia-sns-rg \
  --location koreacentral

# OpenAI API 키 저장
az keyvault secret set \
  --vault-name indonesia-sns-kv \
  --name OpenAIAPIKey \
  --value "<OpenAI_API_키>"

# App Service에 Key Vault 액세스 권한 부여
az webapp identity assign \
  --name indonesia-sns-backend \
  --resource-group indonesia-sns-rg

az keyvault set-policy \
  --name indonesia-sns-kv \
  --object-id <App_Service_Identity_Object_ID> \
  --secret-permissions get list
```

## 모니터링 설정

### Application Insights

```bash
az monitor app-insights component create \
  --app indonesia-sns-insights \
  --location koreacentral \
  --resource-group indonesia-sns-rg

az webapp config appsettings set \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY="<Instrumentation_Key>"
```

## 네트워크 보안

### PostgreSQL 방화벽 규칙

```bash
# Azure 서비스에서 접근 허용
az postgres flexible-server firewall-rule create \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-postgres \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Redis 방화벽 규칙

```bash
az redis firewall-rule create \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-redis \
  --rule-name AllowAzureServices \
  --start-ip 0.0.0.0 \
  --end-ip 0.0.0.0
```

## 비용 최적화

- 개발 환경: Basic 티어 사용
- 프로덕션 환경: Standard 티어 사용
- 자동 스케일링 설정 고려
- 사용하지 않는 리소스 정리

## 트러블슈팅

### 로그 확인

```bash
# 백엔드 로그
az webapp log tail \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend

# 프론트엔드 로그
az webapp log tail \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-frontend
```

### 연결 테스트

```bash
# PostgreSQL 연결 테스트
psql "postgresql://postgresadmin:<비밀번호>@indonesia-sns-postgres.postgres.database.azure.com:5432/indonesia_sns?sslmode=require"

# Redis 연결 테스트
redis-cli -h indonesia-sns-redis.redis.cache.windows.net -p 6380 -a <비밀번호> ping
```

## 추가 리소스

- [Azure App Service 문서](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for PostgreSQL 문서](https://docs.microsoft.com/azure/postgresql/)
- [Azure Cache for Redis 문서](https://docs.microsoft.com/azure/azure-cache-for-redis/)

