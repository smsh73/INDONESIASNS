-- 초기 데이터 시드

-- 기본 관리자 계정 (비밀번호: admin123 - 프로덕션에서는 반드시 변경 필요)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@kejaksaan.go.id', '$2a$10$rK8X8X8X8X8X8X8X8X8Xe8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'admin'),
('analyst1', 'analyst1@kejaksaan.go.id', '$2a$10$rK8X8X8X8X8X8X8X8X8Xe8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'analyst');

-- 인도네시아 주요 지역 데이터 (예시)
INSERT INTO regions (province, city, district, latitude, longitude) VALUES
('Jakarta', 'Jakarta Pusat', 'Gambir', -6.1751, 106.8650),
('Jakarta', 'Jakarta Selatan', 'Kebayoran Baru', -6.2433, 106.7994),
('Jawa Barat', 'Bandung', 'Bandung Kota', -6.9175, 107.6191),
('Jawa Timur', 'Surabaya', 'Surabaya Pusat', -7.2575, 112.7521),
('Bali', 'Denpasar', 'Denpasar Selatan', -8.6705, 115.2126),
('Sumatera Utara', 'Medan', 'Medan Kota', 3.5952, 98.6722),
('Sulawesi Selatan', 'Makassar', 'Makassar Kota', -5.1477, 119.4327);

-- 기본 검찰청 공식 계정 (예시)
INSERT INTO accounts (username, platform, is_official, account_id, metadata) VALUES
('kejaksaan_official', 'instagram', TRUE, 'kejaksaan_official_id', '{"verified": true, "category": "government"}'),
('kejaksaan_official', 'facebook', TRUE, 'kejaksaan_official_fb', '{"verified": true, "category": "government"}'),
('kejaksaan_official', 'twitter', TRUE, 'kejaksaan_official_tw', '{"verified": true, "category": "government"}');

