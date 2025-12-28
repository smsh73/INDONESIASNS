#!/bin/bash

# Azure App Service 시작 스크립트

echo "Starting application..."

# 환경 변수 확인
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "WARNING: REDIS_URL is not set"
fi

# Node.js 애플리케이션 시작
cd /home/site/wwwroot
node src/server.js

