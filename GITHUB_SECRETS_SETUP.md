# GitHub Secrets 설정 가이드

## 생성된 Azure 자격 증명

### 1. AZURE_CREDENTIALS

다음 JSON을 GitHub Secrets에 추가하세요:

```json
$(cat /tmp/azure-credentials.json 2>/dev/null || echo "서비스 주체를 생성하세요")
```

**설정 방법:**
1. GitHub 저장소로 이동: https://github.com/smsh73/INDONESIASNS
2. Settings > Secrets and variables > Actions
3. "New repository secret" 클릭
4. Name: `AZURE_CREDENTIALS`
5. Secret: 위 JSON 전체 복사하여 붙여넣기
6. "Add secret" 클릭

### 2. AZURE_CLIENT_ID

ACR 사용자 이름을 사용합니다.

**설정 방법:**
1. "New repository secret" 클릭
2. Name: `AZURE_CLIENT_ID`
3. Secret: `indonesiasnsacr` (또는 ACR 관리자 사용자 이름)
4. "Add secret" 클릭

### 3. AZURE_CLIENT_SECRET

ACR 비밀번호를 사용합니다.

**설정 방법:**
1. "New repository secret" 클릭
2. Name: `AZURE_CLIENT_SECRET`
3. Secret: ACR 비밀번호 (아래 명령어로 확인)
4. "Add secret" 클릭

```bash
az acr credential show --name indonesiasnsacr --query "passwords[0].value" -o tsv
```

## 확인

모든 Secrets가 설정되었는지 확인:

1. GitHub 저장소 > Settings > Secrets and variables > Actions
2. 다음 3개의 secrets가 있는지 확인:
   - ✅ AZURE_CREDENTIALS
   - ✅ AZURE_CLIENT_ID
   - ✅ AZURE_CLIENT_SECRET

## 테스트

Secrets 설정 후:

1. `main` 브랜치에 변경사항 푸시
2. GitHub Actions 탭에서 워크플로우 실행 확인
3. 배포 상태 모니터링

## 문제 해결

### 서비스 주체가 이미 존재하는 경우

```bash
# 기존 서비스 주체 삭제
az ad sp delete --id $(az ad sp list --display-name "indonesia-sns-github-actions" --query "[0].id" -o tsv)

# 재생성
./setup-github-actions.sh
```

### ACR 접근 권한 오류

```bash
# ACR 관리자 사용자 활성화 확인
az acr update --name indonesiasnsacr --admin-enabled true

# 자격 증명 재확인
az acr credential show --name indonesiasnsacr
```

