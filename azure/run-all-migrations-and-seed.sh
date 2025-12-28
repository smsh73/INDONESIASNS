#!/bin/bash

# 모든 마이그레이션 및 샘플 데이터 생성 스크립트

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "📊 마이그레이션 및 샘플 데이터 생성 시작..."

# 비밀번호 읽기
if [ ! -f .postgres-password.txt ]; then
    echo "❌ .postgres-password.txt 파일을 찾을 수 없습니다."
    read -sp "PostgreSQL 비밀번호를 입력하세요: " POSTGRES_PASSWORD
    echo
else
    POSTGRES_PASSWORD=$(cat .postgres-password.txt)
fi

POSTGRES_FQDN="${POSTGRES_SERVER}.postgres.database.azure.com"

# PGPASSWORD 환경 변수 설정 (psql 사용 시)
export PGPASSWORD="$POSTGRES_PASSWORD"
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_PASSWORD}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require"

# Azure CLI를 사용하여 SQL 실행
# 프로젝트 루트로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "1. 마이그레이션 007 실행 중 (created_by nullable 변경)..."
MIGRATION_007=$(cat "$PROJECT_ROOT/database/migrations/007_make_created_by_nullable.sql")

echo "$MIGRATION_007" | az postgres flexible-server execute \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --database-name "$POSTGRES_DB" \
    --admin-user "$POSTGRES_ADMIN_USER" \
    --admin-password "$POSTGRES_PASSWORD" \
    --query-text - \
    --output none 2>&1 | grep -v "already exists" || echo "✅ 마이그레이션 완료"

echo ""
echo "2. 샘플 데이터 생성 중..."
SAMPLE_DATA=$(cat "$PROJECT_ROOT/database/seeds/002_sample_data.sql")

echo "$SAMPLE_DATA" | az postgres flexible-server execute \
    --resource-group "$RESOURCE_GROUP" \
    --name "$POSTGRES_SERVER" \
    --database-name "$POSTGRES_DB" \
    --admin-user "$POSTGRES_ADMIN_USER" \
    --admin-password "$POSTGRES_PASSWORD" \
    --query-text - \
    --output none 2>&1 | grep -v "already exists" | grep -v "NOTICE" || echo "✅ 샘플 데이터 생성 완료"

echo ""
echo "🎉 모든 작업이 완료되었습니다!"
echo ""
echo "생성된 데이터:"
echo "- 지역 데이터 확인: SELECT COUNT(*) FROM regions;"
echo "- SNS 계정 확인: SELECT COUNT(*) FROM accounts;"
echo "- 키워드 확인: SELECT COUNT(*) FROM monitoring_keywords;"
echo "- 해시태그 확인: SELECT COUNT(*) FROM monitoring_hashtags;"
echo "- 포스트 확인: SELECT COUNT(*) FROM posts;"

