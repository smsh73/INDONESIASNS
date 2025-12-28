# Indonesia SNS Monitoring System

인도네시아 SNS 모니터링 및 분석 시스템

## 주요 기능

- **SNS 모니터링**: Facebook, Instagram, TikTok, LinkedIn, WhatsApp 등 다양한 플랫폼 모니터링
- **키워드 기반 수집**: 키워드, 해시태그를 통한 공개 데이터 수집
- **감정 분석**: OpenAI를 활용한 자동 감정 분석
- **위험 분류**: 위험도 자동 분류 및 알림
- **대시보드**: 실시간 통계 및 시각화
- **워크플로우**: 자동화된 워크플로우 실행

## 기술 스택

### Backend
- Node.js (Express)
- PostgreSQL
- Redis
- Docker
- Azure App Service

### Frontend
- React
- TypeScript
- Ant Design
- Chart.js

## 배포

### GitHub Actions를 통한 자동 배포

프로젝트는 GitHub Actions를 통해 Azure에 자동 배포됩니다.

#### 설정 방법

1. **Azure 서비스 주체 생성**
   ```bash
   ./setup-github-actions.sh
   ```

2. **GitHub Secrets 설정**
   - GitHub 저장소 Settings > Secrets and variables > Actions
   - 다음 secrets 추가:
     - `AZURE_CREDENTIALS`: Azure 서비스 주체 JSON
     - `AZURE_CLIENT_ID`: ACR 사용자 이름
     - `AZURE_CLIENT_SECRET`: ACR 비밀번호

3. **자동 배포**
   - `main` 브랜치에 푸시하면 자동으로 배포됩니다
   - 백엔드 변경: `backend/` 경로 변경 시
   - 프론트엔드 변경: `frontend/` 경로 변경 시

자세한 내용은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.

### 수동 배포

```bash
# 백엔드 배포
./azure/deploy-backend.sh

# 프론트엔드 배포
./azure/deploy-frontend.sh
```

## 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (선택사항)

### 설치

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 환경 변수

`.env` 파일을 생성하고 필요한 환경 변수를 설정하세요.

#### Backend
```
DATABASE_URL=postgresql://user:password@localhost:5432/indonesia_sns
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3001
OPENAI_API_KEY=your_openai_api_key
```

#### Frontend
```
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080
```

## 라이선스

MIT
