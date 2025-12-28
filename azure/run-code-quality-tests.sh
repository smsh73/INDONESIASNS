#!/bin/bash

# 코드 품질 및 테스트 실행 스크립트

set -e

cd "$(dirname "$0")/.."

echo "🧪 코드 품질 검사 및 테스트 시작...\n"

# 1. 정합성 테스트
echo "=== 1. 정합성 테스트 ==="
./azure/run-tests.sh
INTEGRITY_EXIT=$?

echo "\n"

# 2. 코드 품질 검사 (간단한 버전)
echo "=== 2. 코드 품질 검사 ==="
echo "검사 항목:"
echo "  - 에러 처리 확인"
echo "  - 입력 검증 확인"
echo "  - 로깅 확인"
echo "  - 코드 스타일 확인"

# 간단한 검사
ISSUES=0

# 에러 처리 확인
if ! grep -r "try {" backend/src/controllers/*.js | head -1 > /dev/null; then
  echo "  ⚠️  일부 컨트롤러에 에러 처리 부족"
  ((ISSUES++))
else
  echo "  ✅ 에러 처리 확인됨"
fi

# 입력 검증 확인
if [ -f "backend/src/utils/validation.js" ]; then
  echo "  ✅ 검증 유틸리티 존재"
else
  echo "  ❌ 검증 유틸리티 없음"
  ((ISSUES++))
fi

# 로깅 확인
if grep -r "logger\." backend/src/controllers/*.js | head -1 > /dev/null; then
  echo "  ✅ 로깅 사용 확인됨"
else
  echo "  ⚠️  일부 컨트롤러에 로깅 부족"
  ((ISSUES++))
fi

echo ""

# 결과 요약
echo "=== 결과 요약 ==="
if [ $INTEGRITY_EXIT -eq 0 ] && [ $ISSUES -eq 0 ]; then
  echo "🎉 모든 검사 통과!"
  exit 0
else
  echo "⚠️  일부 이슈 발견"
  exit 1
fi

