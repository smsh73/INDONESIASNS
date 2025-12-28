#!/bin/bash

# 키워드 등록, 모니터링, 수집 기능 집중 테스트 (SQL 기반)

set -e

RESOURCE_GROUP="indonesia-sns-rg"
POSTGRES_SERVER="indonesia-sns-postgres"
POSTGRES_DB="indonesia_sns"
POSTGRES_ADMIN_USER="postgresadmin"

echo "🔍 키워드 등록, 모니터링, 수집 기능 집중 테스트 시작...\n"

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

PASSED=0
FAILED=0
ISSUES=()

# ============================================
# 1. 키워드 등록 기능 테스트
# ============================================
echo "=== 1. 키워드 등록 기능 테스트 ==="
echo ""

# 1.1 키워드 생성 테스트
echo "1.1 키워드 생성 테스트..."
TEST_KEYWORD="test_keyword_$(date +%s)"
KEYWORD_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, is_active, created_by)
    VALUES ('$TEST_KEYWORD', NULL, 5, 'region', true, NULL)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

if [ -n "$KEYWORD_ID" ] && [ "$KEYWORD_ID" -gt 0 ]; then
    echo "   ✅ 키워드 생성 성공: ID $KEYWORD_ID"
    ((PASSED++))
else
    echo "   ❌ 키워드 생성 실패"
    ((FAILED++))
    ISSUES+=("키워드 생성 실패")
fi

# 1.2 키워드 조회 테스트
echo "1.2 키워드 조회 테스트..."
KEYWORD_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords WHERE keyword = '$TEST_KEYWORD'
" 2>&1 | xargs)

if [ "$KEYWORD_COUNT" = "1" ]; then
    echo "   ✅ 키워드 조회 성공"
    ((PASSED++))
else
    echo "   ❌ 키워드 조회 실패: $KEYWORD_COUNT개 발견"
    ((FAILED++))
    ISSUES+=("키워드 조회 실패")
fi

# 1.3 키워드 수정 테스트
echo "1.3 키워드 수정 테스트..."
UPDATE_RESULT=$(psql "$DATABASE_URL" -t -c "
    UPDATE monitoring_keywords
    SET priority = 10, description = 'Updated test keyword'
    WHERE id = $KEYWORD_ID
    RETURNING priority
" 2>&1 | xargs)

if [ "$UPDATE_RESULT" = "10" ]; then
    echo "   ✅ 키워드 수정 성공"
    ((PASSED++))
else
    echo "   ❌ 키워드 수정 실패"
    ((FAILED++))
    ISSUES+=("키워드 수정 실패")
fi

# 1.4 키워드 중복 방지 테스트
echo "1.4 키워드 중복 방지 테스트..."
DUPLICATE_ERROR=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
    VALUES ('$TEST_KEYWORD', NULL, 5, true, NULL)
" 2>&1 | grep -i "duplicate\|unique\|violates" || echo "SUCCESS")

if echo "$DUPLICATE_ERROR" | grep -qi "duplicate\|unique\|violates"; then
    echo "   ✅ 키워드 중복 방지 정상 동작"
    ((PASSED++))
else
    echo "   ❌ 키워드 중복 방지 실패"
    ((FAILED++))
    ISSUES+=("키워드 중복 방지 실패")
fi

# 1.5 키워드 활성화/비활성화 테스트
echo "1.5 키워드 활성화/비활성화 테스트..."
psql "$DATABASE_URL" -c "
    UPDATE monitoring_keywords SET is_active = false WHERE id = $KEYWORD_ID
" > /dev/null 2>&1

INACTIVE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords WHERE id = $KEYWORD_ID AND is_active = false
" 2>&1 | xargs)

if [ "$INACTIVE_COUNT" = "1" ]; then
    echo "   ✅ 키워드 비활성화 성공"
    ((PASSED++))
else
    echo "   ❌ 키워드 비활성화 실패"
    ((FAILED++))
    ISSUES+=("키워드 비활성화 실패")
fi

psql "$DATABASE_URL" -c "
    UPDATE monitoring_keywords SET is_active = true WHERE id = $KEYWORD_ID
" > /dev/null 2>&1

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM monitoring_keywords WHERE id = $KEYWORD_ID" > /dev/null 2>&1

# ============================================
# 2. 모니터링 기능 테스트
# ============================================
echo ""
echo "=== 2. 모니터링 기능 테스트 ==="
echo ""

# 2.1 활성 키워드 조회
echo "2.1 활성 키워드 조회 테스트..."
ACTIVE_KEYWORDS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords WHERE is_active = true
" 2>&1 | xargs)

if [ "$ACTIVE_KEYWORDS" -ge 0 ]; then
    echo "   ✅ 활성 키워드 조회 성공: $ACTIVE_KEYWORDS개"
    ((PASSED++))
else
    echo "   ❌ 활성 키워드 조회 실패"
    ((FAILED++))
    ISSUES+=("활성 키워드 조회 실패")
fi

# 2.2 플랫폼별 키워드 조회
echo "2.2 플랫폼별 키워드 조회 테스트..."
INSTAGRAM_KEYWORDS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords 
    WHERE is_active = true 
    AND (platform = 'instagram' OR platform IS NULL)
" 2>&1 | xargs)

FACEBOOK_KEYWORDS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords 
    WHERE is_active = true 
    AND (platform = 'facebook' OR platform IS NULL)
" 2>&1 | xargs)

echo "   Instagram 키워드: $INSTAGRAM_KEYWORDS개, Facebook 키워드: $FACEBOOK_KEYWORDS개"
if [ "$INSTAGRAM_KEYWORDS" -ge 0 ] && [ "$FACEBOOK_KEYWORDS" -ge 0 ]; then
    echo "   ✅ 플랫폼별 키워드 조회 성공"
    ((PASSED++))
else
    echo "   ❌ 플랫폼별 키워드 조회 실패"
    ((FAILED++))
    ISSUES+=("플랫폼별 키워드 조회 실패")
fi

# 2.3 키워드 매칭 테스트
echo "2.3 키워드 매칭 테스트..."
# 테스트용 키워드 생성
MATCH_KEYWORD="match_test_$(date +%s)"
MATCH_KEYWORD_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
    VALUES ('$MATCH_KEYWORD', NULL, 10, true, NULL)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

# 키워드를 포함한 포스트 생성
MATCH_POST_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO posts (platform, post_id, content, author_username, url, posted_at)
    VALUES ('instagram', 'match_post_$(date +%s)', 'This post contains $MATCH_KEYWORD keyword.', 'test_user', 'https://test.com', CURRENT_TIMESTAMP)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

# 매칭 확인
MATCH_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM posts p
    WHERE p.content ILIKE '%$MATCH_KEYWORD%'
    AND p.id = $MATCH_POST_ID
" 2>&1 | xargs)

if [ "$MATCH_COUNT" = "1" ]; then
    echo "   ✅ 키워드 매칭 성공"
    ((PASSED++))
else
    echo "   ❌ 키워드 매칭 실패"
    ((FAILED++))
    ISSUES+=("키워드 매칭 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM monitoring_keywords WHERE id = $MATCH_KEYWORD_ID" > /dev/null 2>&1
psql "$DATABASE_URL" -c "DELETE FROM posts WHERE id = $MATCH_POST_ID" > /dev/null 2>&1

# 2.4 해시태그 매칭 테스트
echo "2.4 해시태그 매칭 테스트..."
MATCH_HASHTAG="#match_hashtag_$(date +%s)"
MATCH_HASHTAG_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO monitoring_hashtags (hashtag, platform, priority, is_active, created_by)
    VALUES ('$MATCH_HASHTAG', NULL, 9, true, NULL)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

HASHTAG_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_hashtags WHERE id = $MATCH_HASHTAG_ID
" 2>&1 | xargs)

if [ "$HASHTAG_COUNT" = "1" ]; then
    echo "   ✅ 해시태그 생성 및 조회 성공"
    ((PASSED++))
else
    echo "   ❌ 해시태그 생성 실패"
    ((FAILED++))
    ISSUES+=("해시태그 생성 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM monitoring_hashtags WHERE id = $MATCH_HASHTAG_ID" > /dev/null 2>&1

# ============================================
# 3. 수집 기능 테스트
# ============================================
echo ""
echo "=== 3. 수집 기능 테스트 ==="
echo ""

# 3.1 포스트 저장 테스트
echo "3.1 포스트 저장 테스트..."
COLLECT_POST_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO posts (platform, post_id, content, author_username, url, like_count, comment_count, posted_at)
    VALUES ('instagram', 'collect_test_$(date +%s)', 'Test post for collection', 'collector', 'https://test.com', 100, 10, CURRENT_TIMESTAMP)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

if [ -n "$COLLECT_POST_ID" ] && [ "$COLLECT_POST_ID" -gt 0 ]; then
    echo "   ✅ 포스트 저장 성공: ID $COLLECT_POST_ID"
    ((PASSED++))
    
    # 저장된 데이터 검증
    POST_CONTENT=$(psql "$DATABASE_URL" -t -c "
        SELECT content FROM posts WHERE id = $COLLECT_POST_ID
    " 2>&1 | xargs)
    
    if [ "$POST_CONTENT" = "Test post for collection" ]; then
        echo "   ✅ 포스트 내용 검증 성공"
        ((PASSED++))
    else
        echo "   ❌ 포스트 내용 검증 실패"
        ((FAILED++))
        ISSUES+=("포스트 내용 검증 실패")
    fi
else
    echo "   ❌ 포스트 저장 실패"
    ((FAILED++))
    ISSUES+=("포스트 저장 실패")
fi

# 3.2 포스트 중복 방지 테스트
echo "3.2 포스트 중복 방지 테스트..."
DUPLICATE_POST_ID="duplicate_post_$(date +%s)"
FIRST_INSERT=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO posts (platform, post_id, content, author_username, url, posted_at)
    VALUES ('facebook', '$DUPLICATE_POST_ID', 'First version', 'test', 'https://test.com', CURRENT_TIMESTAMP)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

SECOND_INSERT=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO posts (platform, post_id, content, author_username, url, posted_at)
    VALUES ('facebook', '$DUPLICATE_POST_ID', 'Second version', 'test', 'https://test.com', CURRENT_TIMESTAMP)
    ON CONFLICT (post_id) DO UPDATE SET content = EXCLUDED.content
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

if [ "$FIRST_INSERT" = "$SECOND_INSERT" ]; then
    echo "   ✅ 포스트 중복 방지 및 업데이트 성공"
    ((PASSED++))
else
    echo "   ❌ 포스트 중복 방지 실패"
    ((FAILED++))
    ISSUES+=("포스트 중복 방지 실패")
fi

# 업데이트 확인
UPDATED_CONTENT=$(psql "$DATABASE_URL" -t -c "
    SELECT content FROM posts WHERE id = $FIRST_INSERT
" 2>&1 | xargs)

if [ "$UPDATED_CONTENT" = "Second version" ]; then
    echo "   ✅ 포스트 업데이트 확인 성공"
    ((PASSED++))
else
    echo "   ❌ 포스트 업데이트 확인 실패"
    ((FAILED++))
    ISSUES+=("포스트 업데이트 확인 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM posts WHERE id = $FIRST_INSERT" > /dev/null 2>&1
if [ -n "$COLLECT_POST_ID" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM posts WHERE id = $COLLECT_POST_ID" > /dev/null 2>&1
fi

# 3.3 공개 포스트 저장 테스트 (account_id = null)
echo "3.3 공개 포스트 저장 테스트..."
PUBLIC_POST_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO posts (account_id, platform, post_id, content, author_username, url, posted_at)
    VALUES (NULL, 'instagram', 'public_post_$(date +%s)', 'Public post without account', 'public_user', 'https://test.com', CURRENT_TIMESTAMP)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

NULL_ACCOUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM posts WHERE id = $PUBLIC_POST_ID AND account_id IS NULL
" 2>&1 | xargs)

if [ "$NULL_ACCOUNT" = "1" ]; then
    echo "   ✅ 공개 포스트 저장 성공 (account_id: NULL)"
    ((PASSED++))
else
    echo "   ❌ 공개 포스트 저장 실패"
    ((FAILED++))
    ISSUES+=("공개 포스트 저장 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM posts WHERE id = $PUBLIC_POST_ID" > /dev/null 2>&1

# 3.4 수집 작업 로그 테스트
echo "3.4 수집 작업 로그 테스트..."
JOB_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO collection_jobs (platform, account_id, job_type, status, items_collected)
    VALUES ('instagram', NULL, 'public', 'running', 0)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

if [ -n "$JOB_ID" ] && [ "$JOB_ID" -gt 0 ]; then
    echo "   ✅ 수집 작업 로그 생성 성공: ID $JOB_ID"
    ((PASSED++))
    
    # 작업 상태 업데이트 테스트
    UPDATE_STATUS=$(psql "$DATABASE_URL" -t -c "
        UPDATE collection_jobs
        SET status = 'completed', items_collected = 10, completed_at = CURRENT_TIMESTAMP
        WHERE id = $JOB_ID
        RETURNING status
    " 2>&1 | xargs)
    
    if [ "$UPDATE_STATUS" = "completed" ]; then
        echo "   ✅ 수집 작업 상태 업데이트 성공"
        ((PASSED++))
    else
        echo "   ❌ 수집 작업 상태 업데이트 실패"
        ((FAILED++))
        ISSUES+=("수집 작업 상태 업데이트 실패")
    fi
else
    echo "   ❌ 수집 작업 로그 생성 실패"
    ((FAILED++))
    ISSUES+=("수집 작업 로그 생성 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM collection_jobs WHERE id = $JOB_ID" > /dev/null 2>&1

# ============================================
# 4. 통합 테스트
# ============================================
echo ""
echo "=== 4. 통합 테스트 ==="
echo ""

# 4.1 키워드 등록 → 모니터링 → 수집 전체 플로우
echo "4.1 키워드 등록 → 모니터링 → 수집 전체 플로우 테스트..."
FLOW_KEYWORD="flow_test_$(date +%s)"
FLOW_KEYWORD_ID=$(psql "$DATABASE_URL" -t -c "
    INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, is_active, created_by)
    VALUES ('$FLOW_KEYWORD', 'instagram', 10, 'event', true, NULL)
    RETURNING id
" 2>&1 | grep -v "INSERT" | xargs)

# 모니터링 확인
MONITORING_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM monitoring_keywords 
    WHERE id = $FLOW_KEYWORD_ID AND is_active = true
" 2>&1 | xargs)

if [ "$MONITORING_COUNT" = "1" ]; then
    # 포스트 수집 (시뮬레이션)
    FLOW_POST_ID=$(psql "$DATABASE_URL" -t -c "
        INSERT INTO posts (platform, post_id, content, author_username, url, posted_at)
        VALUES ('instagram', 'flow_post_$(date +%s)', 'Event about $FLOW_KEYWORD happening!', 'organizer', 'https://test.com', CURRENT_TIMESTAMP)
        RETURNING id
    " 2>&1 | grep -v "INSERT" | xargs)
    
    # 키워드 매칭 확인
    MATCH_COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) FROM posts p
        WHERE p.id = $FLOW_POST_ID
        AND p.content ILIKE '%$FLOW_KEYWORD%'
    " 2>&1 | xargs)
    
    if [ "$MATCH_COUNT" = "1" ]; then
        echo "   ✅ 전체 플로우 테스트 성공: 키워드 등록 → 모니터링 → 수집 → 매칭"
        ((PASSED++))
    else
        echo "   ❌ 키워드 매칭 실패"
        ((FAILED++))
        ISSUES+=("전체 플로우 키워드 매칭 실패")
    fi
    
    # 테스트 데이터 정리
    psql "$DATABASE_URL" -c "DELETE FROM posts WHERE id = $FLOW_POST_ID" > /dev/null 2>&1
else
    echo "   ❌ 모니터링 확인 실패"
    ((FAILED++))
    ISSUES+=("전체 플로우 모니터링 확인 실패")
fi

# 테스트 데이터 정리
psql "$DATABASE_URL" -c "DELETE FROM monitoring_keywords WHERE id = $FLOW_KEYWORD_ID" > /dev/null 2>&1

# 결과 요약
echo ""
echo "=== 테스트 결과 요약 ==="
echo ""
echo "총 테스트: $((PASSED + FAILED))개"
echo "✅ 통과: $PASSED개"
echo "❌ 실패: $FAILED개"
echo ""

if [ ${#ISSUES[@]} -gt 0 ]; then
    echo "발견된 이슈:"
    for i in "${!ISSUES[@]}"; do
        echo "  $((i+1)). ${ISSUES[$i]}"
    done
    echo ""
fi

if [ $FAILED -eq 0 ]; then
    echo "🎉 모든 테스트 통과!"
    echo ""
    echo "✅ 키워드 등록 기능: 정상 동작"
    echo "✅ 모니터링 기능: 정상 동작"
    echo "✅ 수집 기능: 정상 동작"
    exit 0
else
    echo "⚠️  일부 테스트 실패"
    exit 1
fi

