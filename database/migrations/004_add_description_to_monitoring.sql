-- 모니터링 키워드 및 해시태그 테이블에 description 컬럼 추가

ALTER TABLE monitoring_keywords 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE monitoring_hashtags 
ADD COLUMN IF NOT EXISTS description TEXT;

