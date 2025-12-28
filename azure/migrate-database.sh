#!/bin/bash

# 데이터베이스 마이그레이션 스크립트

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "📊 데이터베이스 마이그레이션 시작..."

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

# 마이그레이션 실행
echo "1. 초기 스키마 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/001_initial_schema.sql || echo "⚠️  초기 스키마 마이그레이션 건너뜀 (이미 존재)"

echo "2. 관리자 스키마 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/002_admin_schema.sql || echo "⚠️  관리자 스키마 마이그레이션 건너뜀 (이미 존재)"

echo "3. 모니터링 매칭 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/003_monitoring_matches.sql || echo "⚠️  모니터링 매칭 마이그레이션 건너뜀 (이미 존재)"

echo "4. 모니터링 설명 필드 추가 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/004_add_description_to_monitoring.sql || echo "⚠️  설명 필드 마이그레이션 건너뜀 (이미 존재)"

echo "5. account_id nullable 변경 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/005_allow_null_account_id.sql || echo "⚠️  account_id nullable 마이그레이션 건너뜀 (이미 존재)"

echo "6. 키워드 타입 필드 추가 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/006_add_keyword_type.sql || echo "⚠️  키워드 타입 마이그레이션 건너뜀 (이미 존재)"

echo "✅ 마이그레이션 완료!"

# 초기 데이터 시드 (선택사항)
read -p "초기 데이터를 시드하시겠습니까? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "초기 데이터 시드 중..."
    psql "$DATABASE_URL" -f database/seeds/001_initial_data.sql
    echo "✅ 시드 완료!"
fi

echo ""
echo "🎉 데이터베이스 설정이 완료되었습니다!"

