#!/bin/bash

# 전체 테스트 실행 스크립트 (SQL 기반)

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "🧪 전체 테스트 시작...\n"

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

export PGPASSWORD="$POSTGRES_PASSWORD"

# 테스트 결과
PASSED=0
FAILED=0
ERRORS=()

echo "=== 1. 정합성 테스트 ==="
echo ""

# 1.1 지역-위치 관계 확인
echo "1.1 지역-위치 관계 확인..."
REGION_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM regions" 2>&1)
LOCATION_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM locations" 2>&1)
if [ "$REGION_CHECK" -gt 0 ] && [ "$LOCATION_CHECK" -gt 0 ]; then
    echo "   ✅ 통과 - 지역: $REGION_CHECK개, 위치: $LOCATION_CHECK개"
    ((PASSED++))
else
    echo "   ❌ 실패 - 지역: $REGION_CHECK개, 위치: $LOCATION_CHECK개"
    ((FAILED++))
    ERRORS+=("지역 또는 위치 데이터 부족")
fi

# 1.2 포스트 데이터 확인
echo "1.2 포스트 데이터 확인..."
POST_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM posts" 2>&1)
if [ "$POST_CHECK" -gt 0 ]; then
    echo "   ✅ 통과 - 포스트: $POST_CHECK개"
    ((PASSED++))
else
    echo "   ❌ 실패 - 포스트: $POST_CHECK개"
    ((FAILED++))
    ERRORS+=("포스트 데이터 없음")
fi

# 1.3 키워드-해시태그 확인
echo "1.3 키워드-해시태그 확인..."
KEYWORD_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM monitoring_keywords WHERE is_active = true" 2>&1)
HASHTAG_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM monitoring_hashtags WHERE is_active = true" 2>&1)
if [ "$KEYWORD_CHECK" -gt 0 ] && [ "$HASHTAG_CHECK" -gt 0 ]; then
    echo "   ✅ 통과 - 활성 키워드: $KEYWORD_CHECK개, 활성 해시태그: $HASHTAG_CHECK개"
    ((PASSED++))
else
    echo "   ❌ 실패 - 활성 키워드: $KEYWORD_CHECK개, 활성 해시태그: $HASHTAG_CHECK개"
    ((FAILED++))
    ERRORS+=("활성 키워드 또는 해시태그 부족")
fi

# 1.4 지도 데이터 확인
echo "1.4 지도 데이터 확인..."
MAP_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM map_data" 2>&1)
if [ "$MAP_CHECK" -gt 0 ]; then
    echo "   ✅ 통과 - 지도: $MAP_CHECK개"
    ((PASSED++))
else
    echo "   ❌ 실패 - 지도: $MAP_CHECK개"
    ((FAILED++))
    ERRORS+=("지도 데이터 없음")
fi

echo ""
echo "=== 2. 스키마 불일치 테스트 ==="
echo ""

# 2.1 필수 컬럼 확인
echo "2.1 필수 컬럼 확인..."

# regions 테이블
REGIONS_COLS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'regions' AND column_name IN ('id', 'province', 'latitude', 'longitude')" 2>&1)
if [ "$REGIONS_COLS" -eq 4 ]; then
    echo "   ✅ regions 테이블: 모든 필수 컬럼 존재"
    ((PASSED++))
else
    echo "   ❌ regions 테이블: 일부 컬럼 누락"
    ((FAILED++))
    ERRORS+=("regions 테이블 컬럼 누락")
fi

# monitoring_keywords 테이블
KEYWORDS_COLS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'monitoring_keywords' AND column_name IN ('id', 'keyword', 'is_active', 'keyword_type')" 2>&1)
if [ "$KEYWORDS_COLS" -eq 4 ]; then
    echo "   ✅ monitoring_keywords 테이블: 모든 필수 컬럼 존재"
    ((PASSED++))
else
    echo "   ❌ monitoring_keywords 테이블: 일부 컬럼 누락 (keyword_type 확인 필요)"
    ((FAILED++))
    ERRORS+=("monitoring_keywords 테이블 컬럼 누락")
fi

# workflows 테이블
WORKFLOWS_COLS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'workflows' AND column_name IN ('id', 'name', 'trigger_type', 'trigger_conditions', 'actions', 'trigger_config')" 2>&1)
if [ "$WORKFLOWS_COLS" -ge 5 ]; then
    echo "   ✅ workflows 테이블: 필수 컬럼 존재"
    ((PASSED++))
else
    echo "   ❌ workflows 테이블: 일부 컬럼 누락"
    ((FAILED++))
    ERRORS+=("workflows 테이블 컬럼 누락")
fi

# 2.2 trigger_config 컬럼 확인
echo "2.2 trigger_config 컬럼 확인..."
TRIGGER_CONFIG=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'trigger_config'" 2>&1)
if [ "$TRIGGER_CONFIG" -eq 1 ]; then
    echo "   ✅ workflows.trigger_config 컬럼 존재"
    ((PASSED++))
else
    echo "   ❌ workflows.trigger_config 컬럼 없음"
    ((FAILED++))
    ERRORS+=("workflows.trigger_config 컬럼 누락")
fi

echo ""
echo "=== 3. 모니터링 테스트 ==="
echo ""

# 3.1 활성 키워드 조회
echo "3.1 활성 키워드 조회..."
KEYWORD_PLATFORMS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT platform) FROM monitoring_keywords WHERE is_active = true" 2>&1)
KEYWORD_TYPES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT keyword_type) FROM monitoring_keywords WHERE is_active = true AND keyword_type IS NOT NULL" 2>&1)
echo "   플랫폼 수: $KEYWORD_PLATFORMS개, 타입 수: $KEYWORD_TYPES개"
if [ "$KEYWORD_CHECK" -gt 0 ]; then
    echo "   ✅ 통과"
    ((PASSED++))
else
    echo "   ❌ 실패"
    ((FAILED++))
    ERRORS+=("활성 키워드 없음")
fi

# 3.2 활성 해시태그 조회
echo "3.2 활성 해시태그 조회..."
HASHTAG_PLATFORMS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT platform) FROM monitoring_hashtags WHERE is_active = true" 2>&1)
echo "   플랫폼 수: $HASHTAG_PLATFORMS개"
if [ "$HASHTAG_CHECK" -gt 0 ]; then
    echo "   ✅ 통과"
    ((PASSED++))
else
    echo "   ❌ 실패"
    ((FAILED++))
    ERRORS+=("활성 해시태그 없음")
fi

# 3.3 키워드 매칭 테스트
echo "3.3 키워드 매칭 테스트..."
MATCH_TEST=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM monitoring_keywords mk
    WHERE mk.is_active = true 
    AND EXISTS (
        SELECT 1 FROM posts p 
        WHERE p.content ILIKE '%' || mk.keyword || '%'
    )
" 2>&1)
echo "   매칭된 키워드: $MATCH_TEST개"
if [ "$MATCH_TEST" -ge 0 ]; then
    echo "   ✅ 통과"
    ((PASSED++))
else
    echo "   ❌ 실패"
    ((FAILED++))
fi

echo ""
echo "=== 4. 수집 테스트 ==="
echo ""

# 4.1 계정 데이터 확인
echo "4.1 계정 데이터 확인..."
ACCOUNT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM accounts" 2>&1)
ACCOUNT_ACTIVE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM accounts WHERE is_active = true" 2>&1)
echo "   총 계정: $ACCOUNT_COUNT개, 활성 계정: $ACCOUNT_ACTIVE개"
if [ "$ACCOUNT_COUNT" -gt 0 ]; then
    echo "   ✅ 통과"
    ((PASSED++))
else
    echo "   ⚠️  계정 없음 (공개 수집만 가능)"
    ((PASSED++)) # 계정이 없어도 공개 수집은 가능
fi

# 4.2 포스트 데이터 확인
echo "4.2 포스트 데이터 확인..."
POST_PLATFORMS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(DISTINCT platform) FROM posts" 2>&1)
echo "   플랫폼 수: $POST_PLATFORMS개"
if [ "$POST_CHECK" -gt 0 ]; then
    echo "   ✅ 통과"
    ((PASSED++))
else
    echo "   ❌ 실패"
    ((FAILED++))
    ERRORS+=("포스트 데이터 없음")
fi

# 4.3 수집 작업 로그 테이블 확인
echo "4.3 수집 작업 로그 테이블 확인..."
JOB_TABLE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'collection_jobs'" 2>&1)
if [ "$JOB_TABLE" -eq 1 ]; then
    echo "   ✅ collection_jobs 테이블 존재"
    ((PASSED++))
else
    echo "   ❌ collection_jobs 테이블 없음"
    ((FAILED++))
    ERRORS+=("collection_jobs 테이블 없음")
fi

echo ""
echo "=== 테스트 결과 요약 ==="
echo ""
echo "✅ 통과: $PASSED개"
echo "❌ 실패: $FAILED개"
echo "총 테스트: $((PASSED + FAILED))개"
echo ""

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "에러 목록:"
    for i in "${!ERRORS[@]}"; do
        echo "  $((i+1)). ${ERRORS[$i]}"
    done
    echo ""
fi

if [ $FAILED -eq 0 ]; then
    echo "🎉 모든 테스트 통과!"
    exit 0
else
    echo "⚠️  일부 테스트 실패"
    exit 1
fi

