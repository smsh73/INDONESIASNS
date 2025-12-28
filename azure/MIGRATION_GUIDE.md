# 마이그레이션 및 샘플 데이터 생성 가이드

## 방법 1: Node.js 스크립트 사용 (권장)

Node.js가 설치되어 있는 경우:

```bash
cd backend
node run-migration-and-seed.js
```

## 방법 2: Azure Portal Query Editor 사용

Node.js가 없는 경우 Azure Portal을 통해 직접 실행:

1. [Azure Portal](https://portal.azure.com) 접속
2. 리소스 그룹 `indonesia-sns-rg` → PostgreSQL 서버 `indonesia-sns-postgres` 선택
3. 왼쪽 메뉴에서 **"Query editor"** 클릭
4. 관리자 계정으로 로그인 (`postgresadmin` / 비밀번호는 `.postgres-password.txt` 파일 참고)

### 마이그레이션 007 실행

```sql
ALTER TABLE monitoring_keywords ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE monitoring_hashtags ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN created_by DROP NOT NULL;
```

### 샘플 데이터 생성

`database/seeds/002_sample_data.sql` 파일의 전체 내용을 복사하여 Query Editor에서 실행하세요.

또는 간단 버전:

```sql
-- 지역 데이터 (10개)
INSERT INTO regions (province, city, district, latitude, longitude)
SELECT * FROM (VALUES
('Jakarta', 'Jakarta Pusat', 'Gambir', -6.1751, 106.8650),
('Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', -6.2433, 106.7998),
('Jakarta', 'Jakarta Barat', 'Kebon Jeruk', -6.2000, 106.7833),
('Jakarta', 'Jakarta Timur', 'Cakung', -6.1856, 106.9403),
('Jakarta', 'Jakarta Utara', 'Tanjung Priok', -6.1214, 106.8775),
('West Java', 'Bandung', 'Coblong', -6.9175, 107.6191),
('West Java', 'Bogor', 'Bogor Selatan', -6.5971, 106.8060),
('Central Java', 'Yogyakarta', 'Mergangsan', -7.7956, 110.3695),
('East Java', 'Surabaya', 'Gubeng', -7.2575, 112.7521),
('Bali', 'Denpasar', 'Denpasar Selatan', -8.6705, 115.2126)
) AS v(province, city, district, latitude, longitude)
WHERE NOT EXISTS (
    SELECT 1 FROM regions r 
    WHERE r.province = v.province AND r.city = v.city AND r.district = v.district
);

-- SNS 계정 (5개)
INSERT INTO accounts (platform, username, account_id, is_active, last_sync_at)
SELECT * FROM (VALUES
('facebook', 'sample_facebook_page', '123456789', true, CURRENT_TIMESTAMP),
('instagram', 'sample_instagram_account', '987654321', true, CURRENT_TIMESTAMP),
('facebook', 'indonesia_news_page', '111222333', true, CURRENT_TIMESTAMP),
('instagram', 'jakarta_official', '444555666', true, CURRENT_TIMESTAMP),
('facebook', 'bandung_city', '777888999', true, CURRENT_TIMESTAMP)
) AS v(platform, username, account_id, is_active, last_sync_at)
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.platform = v.platform AND a.username = v.username
);

-- 키워드 (18개)
INSERT INTO monitoring_keywords (keyword, platform, priority, description, keyword_type, is_active)
SELECT * FROM (VALUES
('Jakarta', NULL, 10, '자카르타 지역 관련 키워드', 'region', true),
('Bandung', NULL, 9, '반둥 지역 관련 키워드', 'region', true),
('Surabaya', NULL, 9, '수라바야 지역 관련 키워드', 'region', true),
('Yogyakarta', NULL, 8, '요기아카르타 지역 관련 키워드', 'region', true),
('Bali', NULL, 8, '발리 지역 관련 키워드', 'region', true),
('Kejaksaan', NULL, 10, '검찰청 관련 키워드', 'organization', true),
('Polisi', NULL, 9, '경찰 관련 키워드', 'organization', true),
('Pemerintah', NULL, 8, '정부 관련 키워드', 'organization', true),
('Kementerian', NULL, 8, '부처 관련 키워드', 'organization', true),
('Jokowi', NULL, 10, '조코위 대통령 관련 키워드', 'person', true),
('Prabowo', NULL, 9, '프라보워 관련 키워드', 'person', true),
('Gojek', NULL, 7, '고젝 관련 키워드', 'product', true),
('Tokopedia', NULL, 7, '토코피디아 관련 키워드', 'product', true),
('Pemilu', NULL, 10, '선거 관련 키워드', 'event', true),
('Demonstrasi', NULL, 9, '시위 관련 키워드', 'event', true),
('Indonesia', 'facebook', 8, '인도네시아 페이스북 키워드', 'region', true),
('Jakarta', 'instagram', 9, '자카르타 인스타그램 키워드', 'region', true)
) AS v(keyword, platform, priority, description, keyword_type, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_keywords mk 
    WHERE mk.keyword = v.keyword 
    AND (mk.platform = v.platform OR (mk.platform IS NULL AND v.platform IS NULL))
);

-- 해시태그 (12개)
INSERT INTO monitoring_hashtags (hashtag, platform, priority, description, is_active)
SELECT * FROM (VALUES
('#Jakarta', NULL, 10, '자카르타 해시태그', true),
('#Bandung', NULL, 9, '반둥 해시태그', true),
('#Indonesia', NULL, 10, '인도네시아 해시태그', true),
('#JakartaLife', NULL, 8, '자카르타 생활 해시태그', true),
('#BandungCity', NULL, 8, '반둥 도시 해시태그', true),
('#Kejaksaan', NULL, 10, '검찰청 해시태그', true),
('#PolisiIndonesia', NULL, 9, '인도네시아 경찰 해시태그', true),
('#Jokowi', NULL, 10, '조코위 해시태그', true),
('#Pemilu2024', NULL, 10, '2024 선거 해시태그', true),
('#Gojek', NULL, 7, '고젝 해시태그', true),
('#IndonesiaNews', 'facebook', 9, '인도네시아 뉴스 페이스북 해시태그', true),
('#JakartaOfficial', 'instagram', 9, '자카르타 공식 인스타그램 해시태그', true)
) AS v(hashtag, platform, priority, description, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_hashtags mh 
    WHERE mh.hashtag = v.hashtag 
    AND (mh.platform = v.platform OR (mh.platform IS NULL AND v.platform IS NULL))
);
```

### 데이터 확인

```sql
SELECT 'regions' as table_name, COUNT(*) as count FROM regions
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'keywords', COUNT(*) FROM monitoring_keywords
UNION ALL
SELECT 'hashtags', COUNT(*) FROM monitoring_hashtags
UNION ALL
SELECT 'posts', COUNT(*) FROM posts
UNION ALL
SELECT 'workflows', COUNT(*) FROM workflows;
```

## 완료 후 확인

1. 프론트엔드에서 키워드 등록 기능 테스트
2. 모니터링 시작 기능 테스트
3. 샘플 데이터로 대시보드 및 분석 기능 확인

