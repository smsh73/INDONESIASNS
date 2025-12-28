#!/bin/bash

# 배포 상태 확인 스크립트

RESOURCE_GROUP="indonesia-sns-rg"
BACKEND_APP_NAME="indonesia-sns-backend"
FRONTEND_APP_NAME="indonesia-sns-frontend"

echo "📊 배포 상태 확인"
echo ""

# Resource Group 확인
echo "1. Resource Group:"
az group show --name "$RESOURCE_GROUP" --query "{Name:name, Location:location, ProvisioningState:properties.provisioningState}" -o table
echo ""

# App Services 상태
echo "2. App Services 상태:"
az webapp list --resource-group "$RESOURCE_GROUP" --query "[].{Name:name, State:state, URL:defaultHostName}" -o table
echo ""

# 백엔드 상태
echo "3. 백엔드 상태:"
az webapp show --resource-group "$RESOURCE_GROUP" --name "$BACKEND_APP_NAME" --query "{Name:name, State:state, URL:defaultHostName, Container:siteConfig.linuxFxVersion}" -o table
echo ""

# 프론트엔드 상태
echo "4. 프론트엔드 상태:"
az webapp show --resource-group "$RESOURCE_GROUP" --name "$FRONTEND_APP_NAME" --query "{Name:name, State:state, URL:defaultHostName, Container:siteConfig.linuxFxVersion}" -o table
echo ""

# ACR 이미지
echo "5. ACR 이미지:"
az acr repository list --name indonesiasnsacr --output table
echo ""

# 최근 로그 (선택사항)
read -p "최근 로그를 확인하시겠습니까? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "백엔드 로그 (최근 20줄):"
    az webapp log tail --resource-group "$RESOURCE_GROUP" --name "$BACKEND_APP_NAME" --lines 20 2>/dev/null || echo "로그를 가져올 수 없습니다."
fi

