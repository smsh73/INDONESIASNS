#!/bin/bash

# 샘플 데이터 생성 스크립트

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

# 마이그레이션 먼저 실행 (created_by nullable)
echo "1. 마이그레이션 실행 중..."
psql "$DATABASE_URL" -f database/migrations/007_make_created_by_nullable.sql 2>&1 | grep -v "already exists" || echo "✅ 마이그레이션 완료 (또는 이미 적용됨)"

# 샘플 데이터 생성
echo "2. 샘플 데이터 생성 중..."
psql "$DATABASE_URL" -f database/seeds/002_sample_data.sql

echo ""
echo "🎉 샘플 데이터 생성이 완료되었습니다!"

