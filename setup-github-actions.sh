#!/bin/bash

# GitHub Actions를 위한 Azure 설정 스크립트

echo "=== Azure GitHub Actions 설정 ==="
echo ""

# 구독 ID 가져오기
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "구독 ID: $SUBSCRIPTION_ID"
echo ""

# 리소스 그룹 확인
RESOURCE_GROUP="indonesia-sns-rg"
echo "리소스 그룹: $RESOURCE_GROUP"
echo ""

# 서비스 주체 생성
echo "1. Azure 서비스 주체 생성 중..."
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name "indonesia-sns-github-actions" \
  --role contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --sdk-auth)

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 서비스 주체 생성 완료!"
  echo ""
  echo "=== GitHub Secrets에 추가할 값 ==="
  echo ""
  echo "AZURE_CREDENTIALS:"
  echo "$SP_OUTPUT"
  echo ""
  echo "위 JSON을 GitHub 저장소의 Settings > Secrets > Actions > New repository secret에 추가하세요."
  echo ""
else
  echo "❌ 서비스 주체 생성 실패"
  exit 1
fi

# ACR 정보 확인
echo ""
echo "2. Azure Container Registry 정보 확인 중..."
ACR_NAME="indonesiasnsacr"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "✅ ACR 로그인 서버: $ACR_LOGIN_SERVER"
  
  # ACR 관리자 사용자 활성화
  echo ""
  echo "3. ACR 관리자 사용자 활성화 중..."
  az acr update --name $ACR_NAME --admin-enabled true
  
  # ACR 자격 증명 가져오기
  echo ""
  echo "4. ACR 자격 증명:"
  ACR_CREDS=$(az acr credential show --name $ACR_NAME)
  ACR_USERNAME=$(echo $ACR_CREDS | jq -r '.username')
  ACR_PASSWORD=$(echo $ACR_CREDS | jq -r '.passwords[0].value')
  
  echo ""
  echo "=== GitHub Secrets에 추가할 값 ==="
  echo ""
  echo "AZURE_CLIENT_ID: $ACR_USERNAME"
  echo "AZURE_CLIENT_SECRET: $ACR_PASSWORD"
  echo ""
  echo "위 값들을 GitHub Secrets에 추가하세요."
else
  echo "❌ ACR을 찾을 수 없습니다. 이름을 확인하세요."
fi

echo ""
echo "=== 설정 완료 ==="
echo ""
echo "다음 단계:"
echo "1. GitHub 저장소 (https://github.com/smsh73/INDONESIASNS)로 이동"
echo "2. Settings > Secrets and variables > Actions"
echo "3. 다음 secrets 추가:"
echo "   - AZURE_CREDENTIALS (위의 JSON)"
echo "   - AZURE_CLIENT_ID (ACR 사용자 이름)"
echo "   - AZURE_CLIENT_SECRET (ACR 비밀번호)"
echo ""
echo "설정이 완료되면 main 브랜치에 푸시하면 자동으로 배포됩니다!"

