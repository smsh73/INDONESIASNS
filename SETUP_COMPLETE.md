# 설정 완료 가이드

## ✅ 완료된 작업

1. ✅ Git 저장소 초기화 및 커밋 완료
2. ✅ GitHub Actions 워크플로우 생성 완료
3. ✅ Azure 서비스 주체 생성 완료
4. ✅ ACR 자격 증명 확인 완료

## 📋 다음 단계

### 1. GitHub 저장소 생성

GitHub에서 저장소를 먼저 생성해야 합니다:

1. https://github.com/new 접속
2. Repository name: `INDONESIASNS`
3. Owner: `smsh73`
4. Public 또는 Private 선택
5. **"Initialize this repository with a README" 체크 해제** (이미 로컬에 파일이 있음)
6. "Create repository" 클릭

### 2. GitHub에 푸시

저장소 생성 후 다음 명령어 실행:

```bash
cd /Users/seungminlee/Downloads/INDONESIASNS
git push -u origin main
```

### 3. GitHub Secrets 설정

GitHub 저장소가 생성되면 Secrets를 설정하세요:

**URL**: https://github.com/smsh73/INDONESIASNS/settings/secrets/actions

#### Secret 1: AZURE_CREDENTIALS

Azure 서비스 주체를 생성하여 얻은 JSON 전체를 복사하여 추가:

```bash
# 다음 명령어로 생성
az ad sp create-for-rbac --name "indonesia-sns-github-actions" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/indonesia-sns-rg \
  --sdk-auth
```

출력된 JSON 전체를 복사하여 `AZURE_CREDENTIALS` Secret에 추가하세요.

#### Secret 2: AZURE_CLIENT_ID

ACR 사용자 이름을 사용합니다. 다음 명령어로 확인:

```bash
az acr credential show --name indonesiasnsacr --query "username" -o tsv
```

#### Secret 3: AZURE_CLIENT_SECRET

ACR 비밀번호를 사용합니다. 다음 명령어로 확인:

```bash
az acr credential show --name indonesiasnsacr --query "passwords[0].value" -o tsv
```

**또는 `setup-github-actions.sh` 스크립트를 실행하면 모든 값이 출력됩니다.**

### 4. 자동 배포 확인

Secrets 설정 후:

1. `main` 브랜치에 변경사항 푸시
2. GitHub Actions 탭에서 워크플로우 실행 확인
3. 배포 상태 모니터링

## 🔄 워크플로우 동작

- **백엔드 변경** (`backend/` 경로): 자동으로 백엔드만 배포
- **프론트엔드 변경** (`frontend/` 경로): 자동으로 프론트엔드만 배포
- **전체 변경**: 수동 트리거 또는 커밋 메시지에 "backend" 또는 "frontend" 포함 시 해당 부분 배포

## 📝 참고 문서

- `DEPLOYMENT.md` - 배포 가이드
- `GITHUB_SECRETS_SETUP.md` - Secrets 설정 상세 가이드
- `README.md` - 프로젝트 개요

## ⚠️ 보안 주의사항

- 생성된 자격 증명은 절대 공개 저장소에 커밋하지 마세요
- GitHub Secrets에만 저장하고 로컬 파일은 삭제하세요
- 필요시 `.gitignore`에 자격 증명 파일이 포함되어 있는지 확인하세요
