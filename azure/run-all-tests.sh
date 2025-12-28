#!/bin/bash

# 전체 테스트 실행 스크립트

set -e

cd "$(dirname "$0")/.."

echo "🧪 전체 테스트 실행 시작...\n"
echo "========================================\n"

PASSED=0
FAILED=0
TOTAL=0

# 테스트 함수
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo "▶️  실행 중: $test_name"
    echo "----------------------------------------"
    
    TOTAL=$((TOTAL + 1))
    
    if eval "$test_command"; then
        echo "✅ $test_name: 통과\n"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo "❌ $test_name: 실패\n"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Node.js가 설치되어 있는지 확인
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js가 설치되어 있지 않습니다."
    echo "   JavaScript 테스트는 건너뜁니다.\n"
    NODE_AVAILABLE=false
else
    NODE_AVAILABLE=true
    echo "✅ Node.js 발견: $(node --version)\n"
fi

# PostgreSQL 클라이언트가 설치되어 있는지 확인
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql이 설치되어 있지 않습니다."
    echo "   SQL 기반 테스트는 건너뜁니다.\n"
    PSQL_AVAILABLE=false
else
    PSQL_AVAILABLE=true
    echo "✅ psql 발견: $(psql --version)\n"
fi

echo "========================================\n"

# 1. 키워드/모니터링/수집 집중 테스트
if [ "$NODE_AVAILABLE" = true ]; then
    run_test "키워드/모니터링/수집 집중 테스트" \
        "cd backend && node tests/keyword-monitoring-collection-test.js 2>&1"
fi

# 2. 포괄적 테스트
if [ "$NODE_AVAILABLE" = true ]; then
    run_test "포괄적 기능 테스트" \
        "cd backend && node tests/comprehensive-test.js 2>&1"
fi

# 3. API 통합 테스트
if [ "$NODE_AVAILABLE" = true ]; then
    run_test "API 통합 테스트" \
        "cd backend && node tests/api-integration-test.js 2>&1"
fi

# 4. 데이터 품질 테스트
if [ "$NODE_AVAILABLE" = true ]; then
    run_test "데이터 품질 테스트" \
        "cd backend && node tests/data-quality-test.js 2>&1"
fi

# 5. SQL 기반 테스트
if [ "$PSQL_AVAILABLE" = true ]; then
    run_test "SQL 기반 키워드/모니터링/수집 테스트" \
        "./azure/test-keyword-monitoring-collection.sh 2>&1"
fi

# 결과 요약
echo "========================================\n"
echo "📊 테스트 결과 요약\n"
echo "총 테스트: $TOTAL개"
echo "✅ 통과: $PASSED개"
echo "❌ 실패: $FAILED개\n"

if [ $FAILED -eq 0 ]; then
    echo "🎉 모든 테스트 통과!\n"
    exit 0
else
    echo "⚠️  일부 테스트 실패\n"
    exit 1
fi

