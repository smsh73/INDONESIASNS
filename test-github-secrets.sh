#!/bin/bash

# GitHub Secrets 실제 테스트 스크립트
# 이 스크립트는 GitHub Actions와 동일한 방식으로 인증을 테스트합니다

echo "=== GitHub Secrets 실제 테스트 ==="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ACR_NAME="indonesiasnsacr"
ACR_REGISTRY="${ACR_NAME}.azurecr.io"

# 1. ACR 자격 증명 확인
echo "1. ACR 자격 증명 확인..."
ACR_CREDS=$(az acr credential show --name $ACR_NAME 2>/dev/null)
if [ $? -eq 0 ]; then
  ACR_USERNAME=$(echo $ACR_CREDS | jq -r '.username' 2>/dev/null)
  ACR_PASSWORD=$(echo $ACR_CREDS | jq -r '.passwords[0].value' 2>/dev/null)
  
  if [ -n "$ACR_USERNAME" ] && [ "$ACR_USERNAME" != "null" ]; then
    echo -e "${GREEN}✅ ACR 사용자 이름: $ACR_USERNAME${NC}"
    echo "   → GitHub Secret 'AZURE_CLIENT_ID'는 이 값이어야 합니다"
  else
    echo -e "${RED}❌ ACR 사용자 이름을 가져올 수 없습니다${NC}"
    exit 1
  fi
  
  if [ -n "$ACR_PASSWORD" ] && [ "$ACR_PASSWORD" != "null" ]; then
    echo -e "${GREEN}✅ ACR 비밀번호 확인됨 (길이: ${#ACR_PASSWORD}자)${NC}"
    echo "   → GitHub Secret 'AZURE_CLIENT_SECRET'은 이 값이어야 합니다"
  else
    echo -e "${RED}❌ ACR 비밀번호를 가져올 수 없습니다${NC}"
    exit 1
  fi
else
  echo -e "${RED}❌ ACR 자격 증명을 가져올 수 없습니다${NC}"
  exit 1
fi

echo ""

# 2. ACR 로그인 테스트 (Docker가 설치되어 있는 경우)
echo "2. ACR 로그인 테스트..."
if command -v docker &> /dev/null; then
  echo "Docker 로그인 시도 중..."
  echo "$ACR_PASSWORD" | docker login $ACR_REGISTRY -u $ACR_USERNAME --password-stdin 2>&1 | head -5
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ ACR 로그인 성공${NC}"
    docker logout $ACR_REGISTRY > /dev/null 2>&1
  else
    echo -e "${YELLOW}⚠️  ACR 로그인 실패 (Docker가 실행 중이 아니거나 네트워크 문제일 수 있음)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Docker가 설치되어 있지 않아 로그인 테스트를 건너뜁니다${NC}"
fi

echo ""

# 3. Service Principal 확인
echo "3. Service Principal 확인..."
SP_NAME="indonesia-sns-github-actions"
SP_INFO=$(az ad sp list --display-name "$SP_NAME" --query "[0]" -o json 2>/dev/null)

if [ $? -eq 0 ] && [ "$SP_INFO" != "null" ] && [ -n "$SP_INFO" ]; then
  SP_APP_ID=$(echo $SP_INFO | jq -r '.appId' 2>/dev/null)
  SP_DISPLAY_NAME=$(echo $SP_INFO | jq -r '.displayName' 2>/dev/null)
  
  if [ -n "$SP_APP_ID" ] && [ "$SP_APP_ID" != "null" ]; then
    echo -e "${GREEN}✅ Service Principal 존재${NC}"
    echo "   이름: $SP_DISPLAY_NAME"
    echo "   App ID: $SP_APP_ID"
    echo "   → GitHub Secret 'AZURE_CREDENTIALS'의 'clientId'는 이 값이어야 합니다"
    
    # Service Principal의 clientSecret 확인 (만료되지 않은 것)
    echo ""
    echo "4. Service Principal 자격 증명 확인..."
    SP_CREDS=$(az ad sp credential list --id $SP_APP_ID --query "[?endDate==null || endDate>=\`$(date -u +%Y-%m-%dT%H:%M:%SZ)\`]" -o json 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$SP_CREDS" != "[]" ] && [ -n "$SP_CREDS" ]; then
      CRED_COUNT=$(echo $SP_CREDS | jq 'length' 2>/dev/null)
      echo -e "${GREEN}✅ 활성 자격 증명 $CRED_COUNT개 발견${NC}"
      echo "   → GitHub Secret 'AZURE_CREDENTIALS'의 'clientSecret'이 설정되어 있어야 합니다"
    else
      echo -e "${YELLOW}⚠️  활성 자격 증명을 찾을 수 없습니다${NC}"
      echo "   → Service Principal의 clientSecret이 만료되었거나 없을 수 있습니다"
      echo "   → 재생성이 필요할 수 있습니다"
    fi
  else
    echo -e "${RED}❌ Service Principal App ID를 가져올 수 없습니다${NC}"
  fi
else
  echo -e "${RED}❌ Service Principal을 찾을 수 없습니다: $SP_NAME${NC}"
  echo "   → Service Principal을 생성해야 합니다"
fi

echo ""

# 4. 권한 확인
echo "5. Service Principal 권한 확인..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="indonesia-sns-rg"

if [ -n "$SP_APP_ID" ] && [ "$SP_APP_ID" != "null" ]; then
  ROLE_ASSIGNMENTS=$(az role assignment list \
    --assignee $SP_APP_ID \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
    --query "[].roleDefinitionName" -o tsv 2>/dev/null)
  
  if [ $? -eq 0 ] && [ -n "$ROLE_ASSIGNMENTS" ]; then
    echo -e "${GREEN}✅ 리소스 그룹 권한:${NC}"
    echo "$ROLE_ASSIGNMENTS" | while read role; do
      echo "   - $role"
    done
  else
    echo -e "${YELLOW}⚠️  리소스 그룹 권한이 없거나 확인할 수 없습니다${NC}"
  fi
fi

echo ""
echo "=== 검증 결과 요약 ==="
echo ""
echo "✅ ACR 자격 증명:"
echo "   AZURE_CLIENT_ID = $ACR_USERNAME"
echo "   AZURE_CLIENT_SECRET = (길이: ${#ACR_PASSWORD}자)"
echo ""
if [ -n "$SP_APP_ID" ] && [ "$SP_APP_ID" != "null" ]; then
  echo "✅ Service Principal:"
  echo "   AZURE_CREDENTIALS.clientId = $SP_APP_ID"
  echo "   AZURE_CREDENTIALS.clientSecret = (설정되어 있어야 함)"
  echo ""
  echo "📋 GitHub Secrets 확인 체크리스트:"
  echo "   [ ] AZURE_CLIENT_ID = $ACR_USERNAME"
  echo "   [ ] AZURE_CLIENT_SECRET = (위 ACR 비밀번호와 일치)"
  echo "   [ ] AZURE_CREDENTIALS.clientId = $SP_APP_ID"
  echo "   [ ] AZURE_CREDENTIALS.clientSecret = (설정되어 있음)"
  echo "   [ ] AZURE_CREDENTIALS.subscriptionId = $SUBSCRIPTION_ID"
  echo "   [ ] AZURE_CREDENTIALS.tenantId = (설정되어 있음)"
else
  echo "❌ Service Principal이 없습니다. 생성이 필요합니다."
fi
echo ""

