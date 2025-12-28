#!/bin/bash

# 새로운 마이그레이션만 실행하는 스크립트 (005, 006)

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "📊 새로운 마이그레이션 실행 시작..."

# 비밀번호 읽기
if [ ! -f .postgres-password.txt ]; then
    echo "❌ .postgres-password.txt 파일을 찾을 수 없습니다."
    read -sp "PostgreSQL 비밀번호를 입력하세요: " POSTGRES_PASSWORD
    echo
else
    POSTGRES_PASSWORD=$(cat .postgres-password.txt)
fi

POSTGRES_FQDN="${POSTGRES_SERVER}.postgres.database.azure.com"

# Azure CLI를 사용하여 SQL 실행
echo "5. account_id nullable 변경 마이그레이션 실행 중..."
az postgres flexible-server execute \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --database-name "$POSTGRES_DB" \
    --admin-user "$POSTGRES_ADMIN_USER" \
    --admin-password "$POSTGRES_PASSWORD" \
    --file-path database/migrations/005_allow_null_account_id.sql \
    --output none 2>&1 | grep -v "already exists" || echo "✅ 완료 (또는 이미 적용됨)"

echo "6. 키워드 타입 필드 추가 마이그레이션 실행 중..."
az postgres flexible-server execute \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --database-name "$POSTGRES_DB" \
    --admin-user "$POSTGRES_ADMIN_USER" \
    --admin-password "$POSTGRES_PASSWORD" \
    --file-path database/migrations/006_add_keyword_type.sql \
    --output none 2>&1 | grep -v "already exists" || echo "✅ 완료 (또는 이미 적용됨)"

echo ""
echo "🎉 마이그레이션이 완료되었습니다!"

