#!/bin/bash

# 모든 테스트 실행 스크립트

set -e

echo "🧪 전체 테스트 시작...\n"

cd "$(dirname "$0")/.."

# 1. 정합성 및 스키마 테스트
echo "=== 1. 정합성 및 스키마 테스트 ==="
node tests/integrity-test.js
INTEGRITY_EXIT=$?

echo "\n"

# 2. 모니터링 테스트
echo "=== 2. 모니터링 테스트 ==="
node tests/monitoring-test.js
MONITORING_EXIT=$?

echo "\n"

# 3. 수집 테스트
echo "=== 3. 수집 테스트 ==="
node tests/collection-test.js
COLLECTION_EXIT=$?

echo "\n"

# 결과 요약
echo "=== 전체 테스트 결과 ==="
echo "정합성/스키마 테스트: $([ $INTEGRITY_EXIT -eq 0 ] && echo '✅ 통과' || echo '❌ 실패')"
echo "모니터링 테스트: $([ $MONITORING_EXIT -eq 0 ] && echo '✅ 통과' || echo '❌ 실패')"
echo "수집 테스트: $([ $COLLECTION_EXIT -eq 0 ] && echo '✅ 통과' || echo '❌ 실패')"

TOTAL_EXIT=$((INTEGRITY_EXIT + MONITORING_EXIT + COLLECTION_EXIT))

if [ $TOTAL_EXIT -eq 0 ]; then
  echo "\n🎉 모든 테스트 통과!"
  exit 0
else
  echo "\n⚠️  일부 테스트 실패"
  exit 1
fi

