# Azure 클라우드 빌드 설정 가이드

## GitHub Actions를 통한 자동 배포 설정

### 1. Azure 서비스 주체(Service Principal) 생성

Azure CLI를 사용하여 서비스 주체를 생성합니다:

```bash
az ad sp create-for-rbac --name "indonesia-sns-github-actions" \
  --role contributor \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/indonesia-sns-rg \
  --sdk-auth
```

출력된 JSON을 복사합니다.

### 2. GitHub Secrets 설정

GitHub 저장소의 Settings > Secrets and variables > Actions에서 다음 secrets를 추가합니다:

#### 필수 Secrets:

1. **AZURE_CREDENTIALS**
   - 위에서 생성한 서비스 주체의 전체 JSON 출력
   - 예: `{"clientId":"...","clientSecret":"...","subscriptionId":"...","tenantId":"..."}`

2. **AZURE_CLIENT_ID**
   - Azure Container Registry의 서비스 주체 Client ID
   - 또는 ACR 관리자 사용자 이름

3. **AZURE_CLIENT_SECRET**
   - Azure Container Registry의 서비스 주체 Secret
   - 또는 ACR 관리자 비밀번호

### 3. Azure Container Registry 인증 정보 확인

```bash
# ACR 관리자 사용자 활성화
az acr update --name indonesiasnsacr --admin-enabled true

# ACR 로그인 서버 및 자격 증명 확인
az acr credential show --name indonesiasnsacr
```

### 4. GitHub Actions 워크플로우

프로젝트에는 다음 워크플로우가 포함되어 있습니다:

- **`.github/workflows/azure-backend.yml`**: 백엔드 변경 시 자동 배포
- **`.github/workflows/azure-frontend.yml`**: 프론트엔드 변경 시 자동 배포
- **`.github/workflows/azure-full-deploy.yml`**: 전체 배포 (수동 트리거 또는 모든 변경사항)

### 5. 워크플로우 트리거

- **자동 트리거**: `main` 브랜치에 푸시 시 해당 경로 변경 감지
- **수동 트리거**: GitHub Actions 탭에서 "Run workflow" 버튼 클릭

### 6. 배포 확인

배포 상태는 GitHub 저장소의 Actions 탭에서 확인할 수 있습니다.

## 수동 배포 (대안)

GitHub Actions를 사용하지 않는 경우, 기존 배포 스크립트를 사용할 수 있습니다:

```bash
# 백엔드 배포
./azure/deploy-backend.sh

# 프론트엔드 배포
./azure/deploy-frontend.sh
```

## 문제 해결

### 인증 오류
- Azure 서비스 주체가 올바른 권한을 가지고 있는지 확인
- GitHub Secrets가 올바르게 설정되었는지 확인

### 빌드 실패
- Dockerfile이 올바른지 확인
- Azure Container Registry에 접근 권한이 있는지 확인

### 배포 실패
- App Service가 실행 중인지 확인
- 리소스 그룹 이름이 올바른지 확인

