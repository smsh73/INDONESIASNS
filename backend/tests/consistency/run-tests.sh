#!/bin/bash

# 정합성 테스트 실행 스크립트

echo "🧪 정합성 테스트 시작..."
echo ""

# 테스트 데이터베이스 확인
echo "📊 테스트 데이터베이스 확인 중..."
psql -U postgres -lqt | cut -d \| -f 1 | grep -qw indonesia_sns_test
if [ $? -ne 0 ]; then
    echo "⚠️  테스트 데이터베이스가 없습니다. 생성 중..."
    createdb -U postgres indonesia_sns_test
    echo "✅ 테스트 데이터베이스 생성 완료"
fi

# 마이그레이션 실행
echo "📦 데이터베이스 마이그레이션 실행 중..."
psql -U postgres -d indonesia_sns_test -f ../../database/migrations/001_initial_schema.sql > /dev/null 2>&1
psql -U postgres -d indonesia_sns_test -f ../../database/migrations/002_admin_schema.sql > /dev/null 2>&1
echo "✅ 마이그레이션 완료"

# 테스트 실행
echo ""
echo "🚀 테스트 실행 중..."
echo ""

npm run test:consistency

echo ""
echo "✅ 테스트 완료"

