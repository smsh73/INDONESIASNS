-- 샘플 데이터 생성 스크립트
-- 지역, 지도, SNS 계정, 키워드, 해시태그 등 실제 동작 확인을 위한 샘플 데이터

-- 1. 인도네시아 주요 지역 데이터
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
    WHERE r.province = v.province 
    AND r.city = v.city 
    AND r.district = v.district
);

-- 2. 위치 정보 데이터
INSERT INTO locations (province, city, district, latitude, longitude, address, region_id)
SELECT 
    r.province,
    r.city,
    r.district,
    r.latitude,
    r.longitude,
    CONCAT(r.district, ', ', r.city, ', ', r.province) as address,
    r.id
FROM regions r
WHERE NOT EXISTS (
    SELECT 1 FROM locations l WHERE l.region_id = r.id
)
LIMIT 10;

-- 3. 샘플 SNS 계정 데이터 (더 많은 계정 추가)
INSERT INTO accounts (platform, username, account_id, is_official, follower_count, is_active, metadata)
SELECT * FROM (VALUES
('facebook', 'sample_facebook_page', '123456789', false, 5000, true, '{"description": "Sample Facebook page"}'::jsonb),
('instagram', 'sample_instagram_account', '987654321', false, 10000, true, '{"description": "Sample Instagram account"}'::jsonb),
('facebook', 'indonesia_news_page', '111222333', true, 50000, true, '{"description": "Indonesia News Facebook Page"}'::jsonb),
('instagram', 'jakarta_official', '444555666', true, 30000, true, '{"description": "Jakarta Official Instagram"}'::jsonb),
('facebook', 'bandung_city', '777888999', true, 20000, true, '{"description": "Bandung City Facebook"}'::jsonb),
('instagram', 'surabaya_official', '555666777', true, 25000, true, '{"description": "Surabaya Official Instagram"}'::jsonb),
('facebook', 'bali_tourism', '888999000', false, 15000, true, '{"description": "Bali Tourism Facebook"}'::jsonb),
('instagram', 'yogyakarta_city', '999000111', true, 18000, true, '{"description": "Yogyakarta City Instagram"}'::jsonb),
('tiktok', 'indonesia_trends', '111222333', false, 50000, true, '{"description": "Indonesia Trends TikTok"}'::jsonb),
('linkedin', 'indonesia_business', '222333444', false, 8000, true, '{"description": "Indonesia Business LinkedIn"}'::jsonb)
) AS v(platform, username, account_id, is_official, follower_count, is_active, metadata)
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.platform = v.platform 
    AND a.username = v.username
);

-- 4. 모니터링 키워드 샘플 데이터 (지역, 기관명, 인물명, 제품명 등)
INSERT INTO monitoring_keywords (keyword, platform, priority, description, keyword_type, is_active)
SELECT * FROM (VALUES
-- 지역 키워드
('Jakarta', NULL, 10, '자카르타 지역 관련 키워드', 'region', true),
('Bandung', NULL, 9, '반둥 지역 관련 키워드', 'region', true),
('Surabaya', NULL, 9, '수라바야 지역 관련 키워드', 'region', true),
('Yogyakarta', NULL, 8, '요기아카르타 지역 관련 키워드', 'region', true),
('Bali', NULL, 8, '발리 지역 관련 키워드', 'region', true),
-- 기관명 키워드
('Kejaksaan', NULL, 10, '검찰청 관련 키워드', 'organization', true),
('Polisi', NULL, 9, '경찰 관련 키워드', 'organization', true),
('Pemerintah', NULL, 8, '정부 관련 키워드', 'organization', true),
('Kementerian', NULL, 8, '부처 관련 키워드', 'organization', true),
-- 인물명 키워드
('Jokowi', NULL, 10, '조코위 대통령 관련 키워드', 'person', true),
('Prabowo', NULL, 9, '프라보워 관련 키워드', 'person', true),
-- 제품명 키워드
('Gojek', NULL, 7, '고젝 관련 키워드', 'product', true),
('Tokopedia', NULL, 7, '토코피디아 관련 키워드', 'product', true),
-- 이벤트 키워드
('Pemilu', NULL, 10, '선거 관련 키워드', 'event', true),
('Demonstrasi', NULL, 9, '시위 관련 키워드', 'event', true),
-- 플랫폼별 키워드
('Indonesia', 'facebook', 8, '인도네시아 페이스북 키워드', 'region', true),
('Jakarta', 'instagram', 9, '자카르타 인스타그램 키워드', 'region', true)
) AS v(keyword, platform, priority, description, keyword_type, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM monitoring_keywords mk 
    WHERE mk.keyword = v.keyword 
    AND (mk.platform = v.platform OR (mk.platform IS NULL AND v.platform IS NULL))
);

-- 5. 모니터링 해시태그 샘플 데이터
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

-- 6. 샘플 포스트 데이터 (공개 데이터 수집 테스트용)
INSERT INTO posts (account_id, platform, post_id, content, author_username, url, like_count, comment_count, share_count, posted_at)
SELECT 
    a.id,
    a.platform,
    CONCAT('sample_post_', a.id, '_', generate_series) as post_id,
    CASE 
        WHEN a.platform = 'facebook' THEN 'Sample Facebook post about Jakarta and Indonesia. #Jakarta #Indonesia'
        WHEN a.platform = 'instagram' THEN 'Sample Instagram post about Bandung city. #Bandung #BandungCity'
        ELSE 'Sample post content'
    END as content,
    a.username as author_username,
    CONCAT('https://', a.platform, '.com/posts/', generate_series) as url,
    (random() * 1000)::int as like_count,
    (random() * 100)::int as comment_count,
    (random() * 50)::int as share_count,
    CURRENT_TIMESTAMP - (random() * interval '30 days') as posted_at
FROM accounts a
CROSS JOIN generate_series(1, 5)
WHERE NOT EXISTS (
    SELECT 1 FROM posts p WHERE p.account_id = a.id AND p.post_id = CONCAT('sample_post_', a.id, '_', generate_series)
)
LIMIT 25;

-- 7. 국가 데이터 (인도네시아)
INSERT INTO countries (name, code, iso_code, latitude, longitude, is_active)
SELECT * FROM (VALUES
('Indonesia', 'ID', 'IDN', -0.7893, 113.9213, true)
) AS v(name, code, iso_code, latitude, longitude, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM countries c WHERE c.code = v.code
);

-- 8. 지역에 국가 연결
UPDATE regions SET country_id = (SELECT id FROM countries WHERE code = 'ID')
WHERE country_id IS NULL;

-- 9. 지도 데이터 (인도네시아 전체 및 주요 지역)
INSERT INTO map_data (country_id, region_id, map_type, map_data, boundaries)
SELECT 
    c.id as country_id,
    NULL as region_id,
    'country' as map_type,
    '{"name": "Indonesia", "type": "country", "center": [-0.7893, 113.9213]}'::jsonb as map_data,
    '{"type": "Polygon", "coordinates": [[[95.0, -11.0], [141.0, -11.0], [141.0, 6.0], [95.0, 6.0], [95.0, -11.0]]]}'::jsonb as boundaries
FROM countries c
WHERE c.code = 'ID'
AND NOT EXISTS (
    SELECT 1 FROM map_data md WHERE md.country_id = c.id AND md.map_type = 'country'
);

-- Jakarta 지역 지도
INSERT INTO map_data (country_id, region_id, map_type, map_data, boundaries)
SELECT 
    c.id as country_id,
    r.id as region_id,
    'city' as map_type,
    jsonb_build_object('name', r.city, 'type', 'city', 'province', r.province) as map_data,
    '{"type": "Polygon", "coordinates": [[[106.7, -6.4], [106.9, -6.4], [106.9, -6.1], [106.7, -6.1], [106.7, -6.4]]]}'::jsonb as boundaries
FROM countries c
CROSS JOIN regions r
WHERE c.code = 'ID' AND r.province = 'Jakarta' AND r.city = 'Jakarta Pusat'
AND NOT EXISTS (
    SELECT 1 FROM map_data md WHERE md.region_id = r.id AND md.map_type = 'city'
)
LIMIT 1;

-- Bandung 지역 지도
INSERT INTO map_data (country_id, region_id, map_type, map_data, boundaries)
SELECT 
    c.id as country_id,
    r.id as region_id,
    'city' as map_type,
    jsonb_build_object('name', r.city, 'type', 'city', 'province', r.province) as map_data,
    '{"type": "Polygon", "coordinates": [[[107.5, -7.0], [107.7, -7.0], [107.7, -6.8], [107.5, -6.8], [107.5, -7.0]]]}'::jsonb as boundaries
FROM countries c
CROSS JOIN regions r
WHERE c.code = 'ID' AND r.province = 'West Java' AND r.city = 'Bandung'
AND NOT EXISTS (
    SELECT 1 FROM map_data md WHERE md.region_id = r.id AND md.map_type = 'city'
)
LIMIT 1;

-- 10. 샘플 워크플로우 데이터 (trigger_conditions 사용, trigger_config는 선택사항)
INSERT INTO workflows (name, description, trigger_type, trigger_conditions, actions, trigger_config, is_active)
SELECT * FROM (VALUES
('키워드 알림 워크플로우', '중요 키워드가 감지되면 알림을 보내는 워크플로우', 'keyword', 
 '{"type": "keyword", "keywords": ["Jokowi", "Pemilu"], "priority": 8}'::jsonb,
 '[{"type": "create_alert", "config": {"severity": "high", "title": "중요 키워드 감지"}}]'::jsonb,
 '{"keywords": ["Jokowi", "Pemilu"], "priority": 8}'::jsonb,
 true),
('지역별 모니터링 워크플로우', 'Jakarta 지역 관련 포스트를 모니터링하는 워크플로우', 'region', 
 '{"type": "region", "regionIds": [1], "priority": 7}'::jsonb,
 '[{"type": "create_alert", "config": {"severity": "medium", "title": "Jakarta 지역 포스트"}}]'::jsonb,
 '{"regions": ["Jakarta"], "priority": 7}'::jsonb,
 true),
('해시태그 분석 워크플로우', '특정 해시태그가 포함된 포스트를 분석하는 워크플로우', 'keyword', 
 '{"type": "keyword", "keywords": ["#Jakarta", "#Indonesia"], "priority": 6}'::jsonb,
 '[{"type": "trigger_analysis", "config": {"analysis_type": "sentiment"}}]'::jsonb,
 '{"hashtags": ["#Jakarta", "#Indonesia"], "priority": 6}'::jsonb,
 true)
) AS v(name, description, trigger_type, trigger_conditions, actions, trigger_config, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM workflows w WHERE w.name = v.name
);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '샘플 데이터 생성 완료!';
    RAISE NOTICE '- 국가: % 개', (SELECT COUNT(*) FROM countries);
    RAISE NOTICE '- 지역: % 개', (SELECT COUNT(*) FROM regions);
    RAISE NOTICE '- 위치: % 개', (SELECT COUNT(*) FROM locations);
    RAISE NOTICE '- 지도: % 개', (SELECT COUNT(*) FROM map_data);
    RAISE NOTICE '- SNS 계정: % 개', (SELECT COUNT(*) FROM accounts);
    RAISE NOTICE '- 키워드: % 개', (SELECT COUNT(*) FROM monitoring_keywords);
    RAISE NOTICE '- 해시태그: % 개', (SELECT COUNT(*) FROM monitoring_hashtags);
    RAISE NOTICE '- 포스트: % 개', (SELECT COUNT(*) FROM posts);
    RAISE NOTICE '- 워크플로우: % 개', (SELECT COUNT(*) FROM workflows);
END $$;

