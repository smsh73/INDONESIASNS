#!/bin/bash

# 마이그레이션 007 실행 스크립트

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "📊 마이그레이션 007 실행 시작..."

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
echo "마이그레이션 007 실행 중 (created_by nullable 변경)..."
MIGRATION_SQL=$(cat database/migrations/007_make_created_by_nullable.sql)

echo "$MIGRATION_SQL" | az postgres flexible-server execute \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --database-name "$POSTGRES_DB" \
    --admin-user "$POSTGRES_ADMIN_USER" \
    --admin-password "$POSTGRES_PASSWORD" \
    --query-text - \
    --output none 2>&1 | grep -v "already exists" || echo "✅ 완료"

echo ""
echo "🎉 마이그레이션이 완료되었습니다!"

