#!/bin/bash

# OpenAI API Key 설정 스크립트

RESOURCE_GROUP="indonesia-sns-rg"
BACKEND_APP_NAME="indonesia-sns-backend"

echo "🔑 OpenAI API Key 설정"
echo ""

read -sp "OpenAI API Key를 입력하세요: " OPENAI_KEY
echo ""

if [ -z "$OPENAI_KEY" ]; then
    echo "❌ API Key가 입력되지 않았습니다."
    exit 1
fi

az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$BACKEND_APP_NAME" \
    --settings OPENAI_API_KEY="$OPENAI_KEY" \
    --output none

echo "✅ OpenAI API Key가 설정되었습니다."

