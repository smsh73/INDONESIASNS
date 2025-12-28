# Azure Portal을 통한 마이그레이션 및 샘플 데이터 생성 가이드

Node.js가 설치되어 있지 않은 경우, Azure Portal의 Query Editor를 사용하여 직접 실행할 수 있습니다.

## 1. Azure Portal 접속

1. [Azure Portal](https://portal.azure.com)에 로그인
2. 리소스 그룹 `indonesia-sns-rg` 선택
3. PostgreSQL 서버 `indonesia-sns-postgres` 선택
4. 왼쪽 메뉴에서 **"Query editor"** 클릭

## 2. 마이그레이션 007 실행

Query Editor에서 다음 SQL을 실행:

```sql
-- created_by 컬럼을 nullable로 변경
ALTER TABLE monitoring_keywords ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE monitoring_hashtags ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN created_by DROP NOT NULL;
```

## 3. 샘플 데이터 생성

Query Editor에서 `database/seeds/002_sample_data.sql` 파일의 내용을 복사하여 실행합니다.

또는 다음 SQL을 직접 실행:

```sql
-- 샘플 데이터 생성 (간단 버전)
-- 지역 데이터
INSERT INTO regions (province, city, district, latitude, longitude)
SELECT * FROM (VALUES
('Jakarta', 'Jakarta Pusat', 'Gambir', -6.1751, 106.8650),
('Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', -6.2433, 106.7998),
('West Java', 'Bandung', 'Coblong', -6.9175, 107.6191)
) AS v(province, city, district, latitude, longitude)
WHERE NOT EXISTS (
    SELECT 1 FROM regions r 
    WHERE r.province = v.province AND r.city = v.city AND r.district = v.district
);

-- SNS 계정
INSERT INTO accounts (platform, username, account_id, is_active, last_sync_at)
SELECT * FROM (VALUES
('facebook', 'sample_facebook_page', '123456789', true, CURRENT_TIMESTAMP),
('instagram', 'sample_instagram_account', '987654321', true, CURRENT_TIMESTAMP)
) AS v(platform, username, account_id, is_active, last_sync_at)
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.platform = v.platform AND a.username = v.username
);

-- 키워드
INSERT INTO monitoring_keywords (keyword, platform, priority, description, keyword_type, is_active)
SELECT * FROM (VALUES
('Jakarta', NULL, 10, '자카르타 지역 관련 키워드', 'region', true),
('Bandung', NULL, 9, '반둥 지역 관련 키워드', 'region', true),
('Kejaksaan', NULL, 10, '검찰청 관련 키워드', 'organization', true),
('Jokowi', NULL, 10, '조코위 대통령 관련 키워드', 'person', true)
) AS v(keyword, platform, priority, description, keyword_type, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_keywords mk 
    WHERE mk.keyword = v.keyword 
    AND (mk.platform = v.platform OR (mk.platform IS NULL AND v.platform IS NULL))
);

-- 해시태그
INSERT INTO monitoring_hashtags (hashtag, platform, priority, description, is_active)
SELECT * FROM (VALUES
('#Jakarta', NULL, 10, '자카르타 해시태그', true),
('#Indonesia', NULL, 10, '인도네시아 해시태그', true),
('#Kejaksaan', NULL, 10, '검찰청 해시태그', true)
) AS v(hashtag, platform, priority, description, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_hashtags mh 
    WHERE mh.hashtag = v.hashtag 
    AND (mh.platform = v.platform OR (mh.platform IS NULL AND v.platform IS NULL))
);
```

## 4. 데이터 확인

```sql
SELECT COUNT(*) as regions_count FROM regions;
SELECT COUNT(*) as accounts_count FROM accounts;
SELECT COUNT(*) as keywords_count FROM monitoring_keywords;
SELECT COUNT(*) as hashtags_count FROM monitoring_hashtags;
SELECT COUNT(*) as posts_count FROM posts;
```

## 참고

전체 샘플 데이터는 `database/seeds/002_sample_data.sql` 파일을 참고하세요.

