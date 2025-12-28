#!/bin/bash

# Azure Container Registry를 통한 배포 스크립트
# 사용자: seunglee@live.co.kr

set -e

# 변수 설정
SUBSCRIPTION_ID=""
RESOURCE_GROUP="indonesia-sns-rg"
LOCATION="koreacentral"
ACR_NAME="indonesiasnsacr"
APP_SERVICE_PLAN="indonesia-sns-plan"
BACKEND_APP_NAME="indonesia-sns-backend"
FRONTEND_APP_NAME="indonesia-sns-frontend"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"
REDIS_NAME="indonesia-sns-redis"

# 색상 출력
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Azure 배포 시작...${NC}"
echo ""

# 1. Azure 로그인 확인
echo -e "${YELLOW}1. Azure 로그인 확인 중...${NC}"
az account show > /dev/null 2>&1 || {
    echo -e "${RED}Azure에 로그인되지 않았습니다. 로그인 중...${NC}"
    az login
}

# 계정 확인
CURRENT_USER=$(az account show --query user.name -o tsv)
echo -e "${GREEN}현재 로그인된 계정: ${CURRENT_USER}${NC}"

if [[ "$CURRENT_USER" != "seunglee@live.co.kr" ]]; then
    echo -e "${YELLOW}경고: seunglee@live.co.kr 계정이 아닙니다.${NC}"
    read -p "계속하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${GREEN}구독 ID: ${SUBSCRIPTION_ID}${NC}"
az account set --subscription "$SUBSCRIPTION_ID"

# 2. Resource Group 생성
echo ""
echo -e "${YELLOW}2. Resource Group 생성 중...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

echo -e "${GREEN}✅ Resource Group 생성 완료: ${RESOURCE_GROUP}${NC}"

# 3. Azure Container Registry 생성
echo ""
echo -e "${YELLOW}3. Azure Container Registry 생성 중...${NC}"
ACR_EXISTS=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_EXISTS" ]; then
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$ACR_NAME" \
        --sku Basic \
        --admin-enabled true \
        --output none
    
    echo -e "${GREEN}✅ ACR 생성 완료: ${ACR_NAME}${NC}"
else
    echo -e "${GREEN}✅ ACR 이미 존재: ${ACR_NAME}${NC}"
fi

# ACR 로그인 (Docker가 없어도 ACR 빌드는 작동함)
echo -e "${YELLOW}ACR 토큰 가져오는 중...${NC}"
ACR_TOKEN=$(az acr login --name "$ACR_NAME" --expose-token --query accessToken -o tsv 2>/dev/null || echo "")
if [ -n "$ACR_TOKEN" ]; then
    echo -e "${GREEN}✅ ACR 토큰 획득 완료${NC}"
fi

# 4. PostgreSQL 데이터베이스 생성
echo ""
echo -e "${YELLOW}4. PostgreSQL 데이터베이스 생성 중...${NC}"
POSTGRES_EXISTS=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$POSTGRES_SERVER" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$POSTGRES_EXISTS" ]; then
    # 비밀번호 생성
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    echo -e "${YELLOW}PostgreSQL 비밀번호 생성됨 (저장해두세요): ${POSTGRES_PASSWORD}${NC}"
    
    az postgres flexible-server create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --location "$LOCATION" \
        --admin-user "$POSTGRES_ADMIN_USER" \
        --admin-password "$POSTGRES_PASSWORD" \
        --sku-name Standard_B1ms \
        --tier Burstable \
        --version 15 \
        --storage-size 32 \
        --public-access 0.0.0.0 \
        --output none
    
    echo -e "${GREEN}✅ PostgreSQL 서버 생성 완료${NC}"
    
    # 방화벽 규칙 추가 (Azure 서비스 접근 허용)
    az postgres flexible-server firewall-rule create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$POSTGRES_SERVER" \
        --rule-name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0 \
        --output none
    
    # 데이터베이스 생성
    az postgres flexible-server db create \
        --resource-group "$RESOURCE_GROUP" \
        --server-name "$POSTGRES_SERVER" \
        --database-name "$POSTGRES_DB" \
        --output none
    
    echo -e "${GREEN}✅ 데이터베이스 생성 완료: ${POSTGRES_DB}${NC}"
    
    # 비밀번호 저장
    echo "$POSTGRES_PASSWORD" > .postgres-password.txt
    chmod 600 .postgres-password.txt
    echo -e "${YELLOW}⚠️  PostgreSQL 비밀번호가 .postgres-password.txt에 저장되었습니다.${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL 서버 이미 존재: ${POSTGRES_SERVER}${NC}"
    if [ -f .postgres-password.txt ]; then
        POSTGRES_PASSWORD=$(cat .postgres-password.txt)
    else
        echo -e "${RED}PostgreSQL 비밀번호를 찾을 수 없습니다. 수동으로 입력해주세요.${NC}"
        read -sp "PostgreSQL 비밀번호: " POSTGRES_PASSWORD
        echo
    fi
fi

# 5. Redis Cache 생성
echo ""
echo -e "${YELLOW}5. Redis Cache 생성 중...${NC}"
REDIS_EXISTS=$(az redis show --resource-group "$RESOURCE_GROUP" --name "$REDIS_NAME" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$REDIS_EXISTS" ]; then
    az redis create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REDIS_NAME" \
        --location "$LOCATION" \
        --sku Basic \
        --vm-size c0 \
        --output none
    
    echo -e "${GREEN}✅ Redis Cache 생성 완료${NC}"
    
    # Redis 비밀번호 가져오기
    REDIS_PASSWORD=$(az redis list-keys --resource-group "$RESOURCE_GROUP" --name "$REDIS_NAME" --query "primaryKey" -o tsv)
    echo "$REDIS_PASSWORD" > .redis-password.txt
    chmod 600 .redis-password.txt
else
    echo -e "${GREEN}✅ Redis Cache 이미 존재: ${REDIS_NAME}${NC}"
    REDIS_PASSWORD=$(az redis list-keys --resource-group "$RESOURCE_GROUP" --name "$REDIS_NAME" --query "primaryKey" -o tsv)
fi

# 6. App Service Plan 생성
echo ""
echo -e "${YELLOW}6. App Service Plan 생성 중...${NC}"
PLAN_EXISTS=$(az appservice plan show --resource-group "$RESOURCE_GROUP" --name "$APP_SERVICE_PLAN" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$PLAN_EXISTS" ]; then
    az appservice plan create \
        --name "$APP_SERVICE_PLAN" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --is-linux \
        --sku B1 \
        --output none
    
    echo -e "${GREEN}✅ App Service Plan 생성 완료${NC}"
else
    echo -e "${GREEN}✅ App Service Plan 이미 존재: ${APP_SERVICE_PLAN}${NC}"
fi

# 7. Docker 이미지 빌드 및 푸시
echo ""
echo -e "${YELLOW}7. Docker 이미지 빌드 및 ACR에 푸시 중...${NC}"

# 백엔드 이미지 빌드
echo -e "${YELLOW}백엔드 이미지 빌드 중...${NC}"
cd "$(dirname "$0")/.."
az acr build \
    --registry "$ACR_NAME" \
    --image indonesia-sns-backend:latest \
    --file docker/Dockerfile.backend \
    --platform linux/amd64 \
    .

echo -e "${GREEN}✅ 백엔드 이미지 빌드 및 푸시 완료${NC}"

# 프론트엔드 이미지 빌드
echo -e "${YELLOW}프론트엔드 이미지 빌드 중...${NC}"
az acr build \
    --registry "$ACR_NAME" \
    --image indonesia-sns-frontend:latest \
    --file docker/Dockerfile.frontend \
    --platform linux/amd64 \
    .

echo -e "${GREEN}✅ 프론트엔드 이미지 빌드 및 푸시 완료${NC}"

# 8. 백엔드 App Service 생성
echo ""
echo -e "${YELLOW}8. 백엔드 App Service 생성 중...${NC}"
BACKEND_EXISTS=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$BACKEND_APP_NAME" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$BACKEND_EXISTS" ]; then
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$APP_SERVICE_PLAN" \
        --name "$BACKEND_APP_NAME" \
        --deployment-container-image-name "${ACR_NAME}.azurecr.io/indonesia-sns-backend:latest" \
        --output none
    
    echo -e "${GREEN}✅ 백엔드 App Service 생성 완료${NC}"
else
    echo -e "${GREEN}✅ 백엔드 App Service 이미 존재: ${BACKEND_APP_NAME}${NC}"
fi

# ACR 인증 설정
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

az webapp config container set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP_NAME" \
    --docker-custom-image-name "${ACR_NAME}.azurecr.io/indonesia-sns-backend:latest" \
    --docker-registry-server-url "https://${ACR_NAME}.azurecr.io" \
    --docker-registry-server-user "$ACR_USERNAME" \
    --docker-registry-server-password "$ACR_PASSWORD" \
    --output none

# 9. 프론트엔드 App Service 생성
echo ""
echo -e "${YELLOW}9. 프론트엔드 App Service 생성 중...${NC}"
FRONTEND_EXISTS=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$FRONTEND_APP_NAME" --query "name" -o tsv 2>/dev/null || echo "")

if [ -z "$FRONTEND_EXISTS" ]; then
    az webapp create \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$APP_SERVICE_PLAN" \
        --name "$FRONTEND_APP_NAME" \
        --deployment-container-image-name "${ACR_NAME}.azurecr.io/indonesia-sns-frontend:latest" \
        --output none
    
    echo -e "${GREEN}✅ 프론트엔드 App Service 생성 완료${NC}"
else
    echo -e "${GREEN}✅ 프론트엔드 App Service 이미 존재: ${FRONTEND_APP_NAME}${NC}"
fi

az webapp config container set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FRONTEND_APP_NAME" \
    --docker-custom-image-name "${ACR_NAME}.azurecr.io/indonesia-sns-frontend:latest" \
    --docker-registry-server-url "https://${ACR_NAME}.azurecr.io" \
    --docker-registry-server-user "$ACR_USERNAME" \
    --docker-registry-server-password "$ACR_PASSWORD" \
    --output none

# 10. 환경 변수 설정
echo ""
echo -e "${YELLOW}10. 환경 변수 설정 중...${NC}"

# PostgreSQL 연결 문자열
POSTGRES_FQDN="${POSTGRES_SERVER}.postgres.database.azure.com"
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_PASSWORD}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require"

# Redis 연결 정보
REDIS_FQDN="${REDIS_NAME}.redis.cache.windows.net"
REDIS_URL="rediss://:${REDIS_PASSWORD}@${REDIS_FQDN}:6380"
REDIS_PASSWORD_ENV="$REDIS_PASSWORD"

# JWT Secret 생성
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# 백엔드 환경 변수
echo -e "${YELLOW}백엔드 환경 변수 설정 중...${NC}"
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP_NAME" \
    --settings \
        NODE_ENV=production \
        PORT=8080 \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        REDIS_PASSWORD="$REDIS_PASSWORD_ENV" \
        JWT_SECRET="$JWT_SECRET" \
        CORS_ORIGIN="https://${FRONTEND_APP_NAME}.azurewebsites.net" \
        AZURE_POSTGRES=true \
        AZURE_REDIS=true \
    --output none

echo -e "${GREEN}✅ 백엔드 환경 변수 설정 완료${NC}"

# 프론트엔드 환경 변수
echo -e "${YELLOW}프론트엔드 환경 변수 설정 중...${NC}"
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FRONTEND_APP_NAME" \
    --settings \
        REACT_APP_API_URL="https://${BACKEND_APP_NAME}.azurewebsites.net/api" \
    --output none

echo -e "${GREEN}✅ 프론트엔드 환경 변수 설정 완료${NC}"

# 11. 데이터베이스 마이그레이션
echo ""
echo -e "${YELLOW}11. 데이터베이스 마이그레이션 실행 중...${NC}"

# 마이그레이션 스크립트를 App Service에서 실행
az webapp deployment container config \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP_NAME" \
    --enable-cd true \
    --output none

# 마이그레이션을 위한 임시 컨테이너 실행 (선택사항)
echo -e "${YELLOW}마이그레이션을 수동으로 실행하려면 다음 명령을 사용하세요:${NC}"
echo "psql \"$DATABASE_URL\" -f database/migrations/001_initial_schema.sql"
echo "psql \"$DATABASE_URL\" -f database/migrations/002_admin_schema.sql"

# 12. 배포 완료 정보 출력
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 배포 완료!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}리소스 정보:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  ACR: $ACR_NAME.azurecr.io"
echo ""
echo -e "${YELLOW}애플리케이션 URL:${NC}"
echo "  Backend:  https://${BACKEND_APP_NAME}.azurewebsites.net"
echo "  Frontend: https://${FRONTEND_APP_NAME}.azurewebsites.net"
echo ""
echo -e "${YELLOW}데이터베이스 정보:${NC}"
echo "  PostgreSQL Server: $POSTGRES_FQDN"
echo "  Database: $POSTGRES_DB"
echo "  Username: $POSTGRES_ADMIN_USER"
echo "  Password: .postgres-password.txt 파일 참조"
echo ""
echo -e "${YELLOW}Redis 정보:${NC}"
echo "  Redis: $REDIS_FQDN"
echo "  Password: .redis-password.txt 파일 참조"
echo ""
echo -e "${YELLOW}⚠️  중요:${NC}"
echo "  1. OpenAI API Key를 백엔드 환경 변수에 추가하세요:"
echo "     az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $BACKEND_APP_NAME --settings OPENAI_API_KEY=your_key"
echo ""
echo "  2. 데이터베이스 마이그레이션을 실행하세요"
echo ""
echo -e "${GREEN}배포가 완료되었습니다! 🎉${NC}"

