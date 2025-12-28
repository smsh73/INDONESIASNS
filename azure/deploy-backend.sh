#!/bin/bash

# 백엔드만 배포하는 스크립트
# 사용법: ./deploy-backend.sh

set -e

# 변수 설정
RESOURCE_GROUP="indonesia-sns-rg"
ACR_NAME="indonesiasnsacr"
BACKEND_APP_NAME="indonesia-sns-backend"

# 색상 출력
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 백엔드 배포 시작...${NC}"
echo ""

# 1. Azure 로그인 확인
echo -e "${YELLOW}1. Azure 로그인 확인 중...${NC}"
az account show > /dev/null 2>&1 || {
    echo -e "${RED}Azure에 로그인되지 않았습니다. 로그인 중...${NC}"
    az login
}

CURRENT_USER=$(az account show --query user.name -o tsv)
echo -e "${GREEN}현재 로그인된 계정: ${CURRENT_USER}${NC}"

# 2. 백엔드 이미지 빌드 및 푸시
echo ""
echo -e "${YELLOW}2. 백엔드 이미지 빌드 및 ACR에 푸시 중...${NC}"
cd "$(dirname "$0")/.."

az acr build \
    --registry "$ACR_NAME" \
    --image indonesia-sns-backend:latest \
    --file docker/Dockerfile.backend \
    --platform linux/amd64 \
    .

echo -e "${GREEN}✅ 백엔드 이미지 빌드 및 푸시 완료${NC}"

# 3. App Service 재시작
echo ""
echo -e "${YELLOW}3. App Service 재시작 중...${NC}"
az webapp restart \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP_NAME"

echo -e "${GREEN}✅ App Service 재시작 완료${NC}"

# 4. 배포 완료
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 백엔드 배포 완료!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}백엔드 URL:${NC}"
echo "  https://${BACKEND_APP_NAME}.azurewebsites.net"
echo ""
echo -e "${GREEN}배포가 완료되었습니다! 🎉${NC}"

