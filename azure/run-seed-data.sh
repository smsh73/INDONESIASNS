#!/bin/bash

# 샘플 데이터 생성 스크립트 (Azure PostgreSQL)

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "📊 샘플 데이터 생성 시작..."

# 비밀번호 읽기
if [ ! -f .postgres-password.txt ]; then
    echo "❌ .postgres-password.txt 파일을 찾을 수 없습니다."
    read -sp "PostgreSQL 비밀번호를 입력하세요: " POSTGRES_PASSWORD
    echo
else
    POSTGRES_PASSWORD=$(cat .postgres-password.txt)
fi

POSTGRES_FQDN="${POSTGRES_SERVER}.postgres.database.azure.com"
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_PASSWORD}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require"

# PGPASSWORD 환경 변수 설정
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "1. 샘플 데이터 생성 중..."
psql "$DATABASE_URL" -f database/seeds/002_sample_data.sql

echo ""
echo "🎉 샘플 데이터 생성이 완료되었습니다!"
echo ""
echo "생성된 데이터 확인:"
psql "$DATABASE_URL" -c "SELECT '지역' as type, COUNT(*) as count FROM regions UNION ALL SELECT '위치', COUNT(*) FROM locations UNION ALL SELECT '지도', COUNT(*) FROM map_data UNION ALL SELECT 'SNS 계정', COUNT(*) FROM accounts UNION ALL SELECT '키워드', COUNT(*) FROM monitoring_keywords UNION ALL SELECT '해시태그', COUNT(*) FROM monitoring_hashtags UNION ALL SELECT '포스트', COUNT(*) FROM posts UNION ALL SELECT '워크플로우', COUNT(*) FROM workflows;"

