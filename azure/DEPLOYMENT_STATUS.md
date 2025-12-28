# 배포 상태

## 현재 배포 진행 중

배포 스크립트가 실행 중입니다. 다음 리소스들이 생성되고 있습니다:

### ✅ 완료된 리소스
- Resource Group: `indonesia-sns-rg`
- Azure Container Registry: `indonesiasnsacr`

### 🔄 진행 중인 리소스
- PostgreSQL Database Server: `indonesia-sns-postgres`
- Redis Cache: `indonesia-sns-redis`
- App Service Plan: `indonesia-sns-plan`
- Docker 이미지 빌드 및 푸시
- App Services (백엔드/프론트엔드)

## 배포 상태 확인

배포 상태를 확인하려면:

```bash
cd azure
./check-deployment.sh
```

또는 수동으로:

```bash
# Resource Group 확인
az group show --name indonesia-sns-rg

# App Services 확인
az webapp list --resource-group indonesia-sns-rg

# 배포 로그 확인
tail -f /tmp/azure-deploy.log
```

## 배포 완료 후 작업

배포가 완료되면 다음 작업을 수행해야 합니다:

### 1. OpenAI API Key 설정
```bash
cd azure
./setup-openai-key.sh
```

### 2. 데이터베이스 마이그레이션
```bash
cd azure
./migrate-database.sh
```

### 3. 애플리케이션 접근
- 프론트엔드: https://indonesia-sns-frontend.azurewebsites.net
- 백엔드 API: https://indonesia-sns-backend.azurewebsites.net/api

## 중요 정보

다음 파일들이 생성되었습니다:
- `.postgres-password.txt`: PostgreSQL 비밀번호
- `.redis-password.txt`: Redis 비밀번호

⚠️ **보안**: 이 파일들을 안전하게 보관하세요!

