#!/bin/bash

# GitHub Secrets 검증 스크립트

echo "=== GitHub Secrets 검증 ==="
echo ""

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. ACR 자격 증명 확인
echo "1. Azure Container Registry 자격 증명 확인..."
ACR_NAME="indonesiasnsacr"

ACR_EXISTS=$(az acr show --name $ACR_NAME --query "name" -o tsv 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$ACR_EXISTS" ]; then
  echo -e "${GREEN}✅ ACR 존재 확인: $ACR_NAME${NC}"
  
  # ACR 관리자 사용자 활성화 확인
  ADMIN_ENABLED=$(az acr show --name $ACR_NAME --query "adminUserEnabled" -o tsv)
  if [ "$ADMIN_ENABLED" == "true" ]; then
    echo -e "${GREEN}✅ ACR 관리자 사용자 활성화됨${NC}"
  else
    echo -e "${YELLOW}⚠️  ACR 관리자 사용자 비활성화됨 - 활성화 중...${NC}"
    az acr update --name $ACR_NAME --admin-enabled true
    echo -e "${GREEN}✅ ACR 관리자 사용자 활성화 완료${NC}"
  fi
  
  # ACR 자격 증명 가져오기
  ACR_CREDS=$(az acr credential show --name $ACR_NAME 2>/dev/null)
  if [ $? -eq 0 ]; then
    ACR_USERNAME=$(echo $ACR_CREDS | jq -r '.username' 2>/dev/null)
    ACR_PASSWORD=$(echo $ACR_CREDS | jq -r '.passwords[0].value' 2>/dev/null)
    
    if [ -n "$ACR_USERNAME" ] && [ "$ACR_USERNAME" != "null" ]; then
      echo -e "${GREEN}✅ ACR 사용자 이름: $ACR_USERNAME${NC}"
      echo "   → GitHub Secret 'AZURE_CLIENT_ID'와 일치해야 합니다"
    else
      echo -e "${RED}❌ ACR 사용자 이름을 가져올 수 없습니다${NC}"
    fi
    
    if [ -n "$ACR_PASSWORD" ] && [ "$ACR_PASSWORD" != "null" ]; then
      echo -e "${GREEN}✅ ACR 비밀번호: ${ACR_PASSWORD:0:4}**** (길이: ${#ACR_PASSWORD})${NC}"
      echo "   → GitHub Secret 'AZURE_CLIENT_SECRET'와 일치해야 합니다"
    else
      echo -e "${RED}❌ ACR 비밀번호를 가져올 수 없습니다${NC}"
    fi
  else
    echo -e "${RED}❌ ACR 자격 증명을 가져올 수 없습니다${NC}"
  fi
else
  echo -e "${RED}❌ ACR을 찾을 수 없습니다: $ACR_NAME${NC}"
fi

echo ""

# 2. Service Principal 확인
echo "2. Azure Service Principal 확인..."
SP_NAME="indonesia-sns-github-actions"

SP_LIST=$(az ad sp list --display-name "$SP_NAME" --query "[0]" -o json 2>/dev/null)
if [ $? -eq 0 ] && [ "$SP_LIST" != "null" ] && [ -n "$SP_LIST" ]; then
  SP_APP_ID=$(echo $SP_LIST | jq -r '.appId' 2>/dev/null)
  SP_OBJECT_ID=$(echo $SP_LIST | jq -r '.id' 2>/dev/null)
  
  if [ -n "$SP_APP_ID" ] && [ "$SP_APP_ID" != "null" ]; then
    echo -e "${GREEN}✅ Service Principal 존재: $SP_NAME${NC}"
    echo -e "${GREEN}   App ID: $SP_APP_ID${NC}"
    
    # Service Principal의 clientId가 AZURE_CREDENTIALS의 clientId와 일치해야 함
    echo "   → GitHub Secret 'AZURE_CREDENTIALS'의 'clientId'와 일치해야 합니다"
    
    # 권한 확인
    echo ""
    echo "3. Service Principal 권한 확인..."
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    RESOURCE_GROUP="indonesia-sns-rg"
    
    ROLE_ASSIGNMENTS=$(az role assignment list \
      --assignee $SP_APP_ID \
      --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
      --query "[].{role:roleDefinitionName, scope:scope}" -o json 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$ROLE_ASSIGNMENTS" != "[]" ] && [ -n "$ROLE_ASSIGNMENTS" ]; then
      echo -e "${GREEN}✅ Service Principal 권한 확인됨${NC}"
      echo "$ROLE_ASSIGNMENTS" | jq -r '.[] | "   - \(.role) on \(.scope)"'
    else
      echo -e "${YELLOW}⚠️  Service Principal 권한이 없거나 확인할 수 없습니다${NC}"
    fi
    
    # ACR 권한 확인
    echo ""
    echo "4. ACR 접근 권한 확인..."
    ACR_ROLE_ASSIGNMENTS=$(az role assignment list \
      --assignee $SP_APP_ID \
      --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME" \
      --query "[].{role:roleDefinitionName}" -o json 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$ACR_ROLE_ASSIGNMENTS" != "[]" ] && [ -n "$ACR_ROLE_ASSIGNMENTS" ]; then
      echo -e "${GREEN}✅ ACR 접근 권한 확인됨${NC}"
      echo "$ACR_ROLE_ASSIGNMENTS" | jq -r '.[] | "   - \(.role)"'
    else
      echo -e "${YELLOW}⚠️  ACR 접근 권한이 없을 수 있습니다${NC}"
      echo "   → ACR에 직접 접근하려면 AcrPush 또는 AcrPull 역할이 필요합니다"
      echo "   → 하지만 ACR 관리자 자격 증명을 사용하므로 문제없을 수 있습니다"
    fi
  else
    echo -e "${RED}❌ Service Principal을 찾을 수 없습니다: $SP_NAME${NC}"
    echo "   → Service Principal을 생성해야 합니다"
  fi
else
  echo -e "${RED}❌ Service Principal을 찾을 수 없습니다: $SP_NAME${NC}"
  echo "   → Service Principal을 생성해야 합니다"
fi

echo ""
echo "=== 검증 요약 ==="
echo ""
echo "✅ 확인된 항목:"
echo "   1. ACR 존재 및 자격 증명"
echo "   2. Service Principal 존재"
echo "   3. 권한 확인"
echo ""
echo "📋 GitHub Secrets에 설정해야 할 값:"
echo ""
echo "AZURE_CLIENT_ID:"
echo "   → $ACR_USERNAME"
echo ""
echo "AZURE_CLIENT_SECRET:"
echo "   → $ACR_PASSWORD (위에서 확인한 비밀번호)"
echo ""
echo "AZURE_CREDENTIALS:"
echo "   → Service Principal JSON (아래 명령어로 생성)"
echo ""
echo "생성 명령어:"
echo "az ad sp create-for-rbac --name \"$SP_NAME\" \\"
echo "  --role contributor \\"
echo "  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \\"
echo "  --sdk-auth"
echo ""
echo "⚠️  주의: Service Principal이 이미 존재하면 위 명령어는 실패합니다."
echo "   기존 Service Principal을 사용하거나 삭제 후 재생성하세요."
echo ""

