# GitHub Secrets 검증 체크리스트

## 검증 완료된 값들

### ✅ 1. AZURE_CLIENT_ID
**현재 ACR 사용자 이름**: `indonesiasnsacr`

**GitHub Secret 확인:**
- [ ] GitHub Secret `AZURE_CLIENT_ID`의 값이 `indonesiasnsacr`인지 확인
- [ ] 값이 일치하면 ✅, 다르면 ❌

**확인 명령어:**
```bash
az acr credential show --name indonesiasnsacr --query "username" -o tsv
```

### ✅ 2. AZURE_CLIENT_SECRET
**현재 ACR 비밀번호**: 길이 52자

**GitHub Secret 확인:**
- [ ] GitHub Secret `AZURE_CLIENT_SECRET`의 값이 ACR 비밀번호와 일치하는지 확인
- [ ] 길이가 52자인지 확인
- [ ] 값이 일치하면 ✅, 다르면 ❌

**확인 명령어:**
```bash
az acr credential show --name indonesiasnsacr --query "passwords[0].value" -o tsv
```

### ✅ 3. AZURE_CREDENTIALS
**Service Principal 정보:**
- **clientId**: `e044d76a-3224-451c-917a-405929602492`
- **subscriptionId**: `af9330f8-2a2c-4948-b1e6-78d04c0217f7`
- **tenantId**: `4d985748-d428-4ba0-a454-3476828d8aa7`

**GitHub Secret 확인:**
- [ ] GitHub Secret `AZURE_CREDENTIALS`가 JSON 형식인지 확인
- [ ] `clientId`가 `e044d76a-3224-451c-917a-405929602492`인지 확인
- [ ] `subscriptionId`가 `af9330f8-2a2c-4948-b1e6-78d04c0217f7`인지 확인
- [ ] `tenantId`가 `4d985748-d428-4ba0-a454-3476828d8aa7`인지 확인
- [ ] `clientSecret`이 설정되어 있는지 확인
- [ ] 모든 값이 일치하면 ✅, 다르면 ❌

**예상 JSON 형식:**
```json
{
  "clientId": "e044d76a-3224-451c-917a-405929602492",
  "clientSecret": "<secret-value>",
  "subscriptionId": "af9330f8-2a2c-4948-b1e6-78d04c0217f7",
  "tenantId": "4d985748-d428-4ba0-a454-3476828d8aa7",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

## 검증 결과

### ✅ 확인된 항목
1. ✅ ACR 존재 및 관리자 사용자 활성화됨
2. ✅ ACR 자격 증명 확인됨
3. ✅ Service Principal 존재 확인됨
4. ✅ Service Principal 권한 확인됨 (Contributor)

### ⚠️ 주의사항
- Service Principal의 `clientSecret`이 만료되었을 수 있습니다
- 만료된 경우 재생성이 필요할 수 있습니다

## 문제 해결

### Service Principal clientSecret 만료된 경우

**방법 1: 기존 Service Principal에 새 자격 증명 추가**
```bash
az ad sp credential reset --id e044d76a-3224-451c-917a-405929602492 --append
```

**방법 2: Service Principal 재생성 (기존 것 삭제 후)**
```bash
# 기존 Service Principal 삭제
az ad sp delete --id e044d76a-3224-451c-917a-405929602492

# 새로 생성
az ad sp create-for-rbac \
  --name "indonesia-sns-github-actions" \
  --role contributor \
  --scopes /subscriptions/af9330f8-2a2c-4948-b1e6-78d04c0217f7/resourceGroups/indonesia-sns-rg \
  --sdk-auth
```

**방법 3: 기존 Service Principal 사용 (clientSecret이 아직 유효한 경우)**
- GitHub Secret `AZURE_CREDENTIALS`의 `clientSecret`이 아직 유효하면 그대로 사용

## 최종 확인

GitHub에서 다음을 확인하세요:

1. **Settings > Secrets and variables > Actions**
2. 다음 3개 Secret이 있는지 확인:
   - ✅ `AZURE_CLIENT_ID` = `indonesiasnsacr`
   - ✅ `AZURE_CLIENT_SECRET` = (ACR 비밀번호와 일치)
   - ✅ `AZURE_CREDENTIALS` = (위 JSON 형식)

3. **각 Secret의 값이 위에서 확인한 값들과 일치하는지 확인**

## 현재 상태

✅ **워크플로우가 성공적으로 실행되고 있으므로**
✅ **Secrets는 올바르게 설정되어 있을 가능성이 매우 높습니다**

다만, Service Principal의 `clientSecret`이 만료되었을 수 있으므로
GitHub Actions에서 인증 오류가 발생하면 위의 문제 해결 방법을 참고하세요.

