#!/bin/bash

# Azure 배포 스크립트
# 사용법: ./deploy.sh <resource-group-name> <location>

set -e

RESOURCE_GROUP=${1:-"indonesia-sns-rg"}
LOCATION=${2:-"koreacentral"}

echo "Azure 리소스 그룹 생성: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "PostgreSQL 서버 생성..."
POSTGRES_SERVER_NAME="indonesia-sns-postgres-$(openssl rand -hex 4)"
POSTGRES_ADMIN_USER="postgresadmin"
POSTGRES_ADMIN_PASSWORD=$(openssl rand -base64 32)

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER_NAME \
  --location $LOCATION \
  --admin-user $POSTGRES_ADMIN_USER \
  --admin-password $POSTGRES_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0

echo "PostgreSQL 데이터베이스 생성..."
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER_NAME \
  --database-name indonesia_sns

echo "Redis Cache 생성..."
REDIS_CACHE_NAME="indonesia-sns-redis-$(openssl rand -hex 4)"
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_CACHE_NAME \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0

echo "App Service Plan 생성..."
az appservice plan create \
  --name indonesia-sns-plan \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku B1

echo "백엔드 App Service 생성..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan indonesia-sns-plan \
  --name indonesia-sns-backend \
  --runtime "NODE:18-lts"

echo "프론트엔드 App Service 생성..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan indonesia-sns-plan \
  --name indonesia-sns-frontend \
  --runtime "NODE:18-lts"

echo "환경 변수 설정..."
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_SERVER_NAME}.postgres.database.azure.com:5432/indonesia_sns?sslmode=require"
REDIS_URL="${REDIS_CACHE_NAME}.redis.cache.windows.net:6380"

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name indonesia-sns-backend \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="$DATABASE_URL" \
    REDIS_URL="$REDIS_URL" \
    JWT_SECRET="$(openssl rand -base64 32)" \
    OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=https://indonesia-sns-kv.vault.azure.net/secrets/OpenAIAPIKey/)" \
    CORS_ORIGIN="https://indonesia-sns-frontend.azurewebsites.net"

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name indonesia-sns-frontend \
  --settings \
    REACT_APP_API_URL="https://indonesia-sns-backend.azurewebsites.net/api" \
    REACT_APP_WS_URL="https://indonesia-sns-backend.azurewebsites.net"

echo "배포 완료!"
echo "PostgreSQL 서버: $POSTGRES_SERVER_NAME"
echo "Redis Cache: $REDIS_CACHE_NAME"
echo "백엔드 URL: https://indonesia-sns-backend.azurewebsites.net"
echo "프론트엔드 URL: https://indonesia-sns-frontend.azurewebsites.net"

