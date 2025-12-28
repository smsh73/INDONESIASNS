-- workflows 테이블에 trigger_config 컬럼 추가
-- trigger_conditions와 함께 사용하거나 대체할 수 있는 새로운 형식

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS trigger_config JSONB;

-- trigger_config가 없으면 trigger_conditions를 사용하도록 유지
-- 기존 데이터는 trigger_conditions를 그대로 사용

COMMENT ON COLUMN workflows.trigger_config IS '워크플로우 트리거 설정 (새로운 형식, trigger_conditions와 함께 사용 가능)';

