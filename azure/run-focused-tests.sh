#!/bin/bash

# 키워드 등록, 모니터링, 수집 기능 집중 테스트 스크립트

set -e

cd "$(dirname "$0")/.."

echo "🔍 키워드 등록, 모니터링, 수집 기능 집중 테스트 시작...\n"

# Node.js가 설치되어 있는지 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "   테스트를 실행하려면 Node.js가 필요합니다."
    exit 1
fi

# 백엔드 디렉토리로 이동
cd backend

echo "=== 집중 테스트 실행 ===\n"
node tests/keyword-monitoring-collection-test.js

EXIT_CODE=$?

echo "\n"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 모든 집중 테스트 통과!"
    exit 0
else
    echo "❌ 일부 테스트 실패"
    exit 1
fi

