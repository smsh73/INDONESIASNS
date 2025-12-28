-- 계정 없이도 데이터 수집 가능하도록 account_id를 nullable로 변경
ALTER TABLE posts ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_account_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_account_id_fkey 
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- collection_jobs 테이블도 nullable로 변경
ALTER TABLE collection_jobs ALTER COLUMN account_id DROP NOT NULL;

