# CORS 오류 수정 내역

## 문제
- 프론트엔드에서 백엔드 API 호출 시 CORS 오류 발생
- `No 'Access-Control-Allow-Origin' header is present on the requested resource`

## 원인 분석
1. CORS origin 매칭 로직이 너무 엄격함
2. OPTIONS preflight 요청 처리 미흡
3. 환경 변수 설정 확인 필요

## 수정 사항

### 1. `backend/src/server.js` - CORS 설정 개선

#### 변경 전:
```javascript
if (corsOrigins.includes(origin)) {
  callback(null, true);
}
```

#### 변경 후:
```javascript
const isAllowed = corsOrigins.some(allowedOrigin => {
  return origin === allowedOrigin || origin.startsWith(allowedOrigin.replace(/\/$/, ''));
});
```

### 2. OPTIONS 요청 처리 개선
- origin 매칭 로직 개선
- 로깅 추가

### 3. 환경 변수 설정
```bash
az webapp config appsettings set \
  --resource-group indonesia-sns-rg \
  --name indonesia-sns-backend \
  --settings CORS_ORIGIN='https://indonesia-sns-frontend.azurewebsites.net'
```

## 배포 상태
- ✅ 코드 수정 완료
- ✅ 환경 변수 설정 완료
- ✅ App Service 재시작 완료

## 검증 방법
1. 브라우저에서 프론트엔드 접속
2. 로그인 시도
3. 개발자 도구 Network 탭에서 CORS 헤더 확인

## 예상 해결 시간
- 서버 재시작 후 1-2분 내 정상 동작 예상

