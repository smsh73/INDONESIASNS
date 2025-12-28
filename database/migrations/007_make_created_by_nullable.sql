-- created_by 컬럼을 nullable로 변경 (키워드/해시태그 등록 시 사용자 정보가 없어도 가능하도록)
ALTER TABLE monitoring_keywords ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE monitoring_hashtags ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN created_by DROP NOT NULL;

