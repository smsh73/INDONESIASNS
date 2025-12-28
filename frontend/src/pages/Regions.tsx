import React, { useEffect, useState } from 'react';
import { Card, Select, Row, Col, Statistic, Table, message } from 'antd';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import './Regions.css';

const { Option } = Select;

interface RegionStats {
  total_posts: number;
  unique_accounts: number;
  sentiment_analyses: number;
  risk_classifications: number;
  sentiment_breakdown: Array<{ category: string; count: number }>;
  risk_breakdown: Array<{ category: string; count: number }>;
}

const Regions: React.FC = () => {
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [stats, setStats] = useState<RegionStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchRegionStats();
    }
  }, [selectedRegion]);

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions?level=province');
      setRegions(response.data.data);
    } catch (error: any) {
      message.error('지역 데이터를 불러오는데 실패했습니다');
    }
  };

  const fetchRegionStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/regions/${encodeURIComponent(selectedRegion)}/stats`);
      // 백엔드가 객체를 반환하므로 그대로 사용
      if (response.data.success && response.data.data) {
        setStats(response.data.data);
      } else {
        setStats(null);
      }
    } catch (error: any) {
      message.error('지역 통계를 불러오는데 실패했습니다');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="regions">
      <h1>지역별 분석</h1>

      <Card style={{ marginBottom: '24px' }}>
        <Select
          placeholder="지역 선택"
          style={{ width: 300 }}
          onChange={setSelectedRegion}
          value={selectedRegion || undefined}
        >
          {regions.map((region) => (
            <Option key={region.name} value={region.name}>
              {region.name}
            </Option>
          ))}
        </Select>
      </Card>

      {selectedRegion && stats && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="총 포스팅"
                  value={stats.total_posts || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="고유 계정"
                  value={stats.unique_accounts || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="감정 분석"
                  value={stats.sentiment_analyses || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="위험 분류"
                  value={stats.risk_classifications || 0}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.sentiment_breakdown && stats.sentiment_breakdown.length > 0 && (
              <Col xs={24} md={12}>
                <Card title="감정 분류 상세">
                  <Table
                    columns={[
                      { title: '감정 카테고리', dataIndex: 'category', key: 'category' },
                      { title: '개수', dataIndex: 'count', key: 'count' },
                    ]}
                    dataSource={stats.sentiment_breakdown}
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
            )}
            {stats.risk_breakdown && stats.risk_breakdown.length > 0 && (
              <Col xs={24} md={12}>
                <Card title="위험 분류 상세">
                  <Table
                    columns={[
                      { title: '위험 카테고리', dataIndex: 'category', key: 'category' },
                      { title: '개수', dataIndex: 'count', key: 'count' },
                    ]}
                    dataSource={stats.risk_breakdown}
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}
      {selectedRegion && !stats && !loading && (
        <Card>
          <p>해당 지역에 대한 통계 데이터가 없습니다.</p>
        </Card>
      )}
    </div>
  );
};

export default Regions;

