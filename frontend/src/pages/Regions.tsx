import React, { useEffect, useState } from 'react';
import { Card, Select, Row, Col, Statistic, Table, message } from 'antd';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import './Regions.css';

const { Option } = Select;

const Regions: React.FC = () => {
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [stats, setStats] = useState<any[]>([]);
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
      const response = await api.get(`/regions/${selectedRegion}/stats`);
      setStats(response.data.data);
    } catch (error: any) {
      message.error('지역 통계를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '감정 카테고리',
      dataIndex: 'sentiment_category',
      key: 'sentiment_category',
    },
    {
      title: '위험 카테고리',
      dataIndex: 'risk_category',
      key: 'risk_category',
    },
    {
      title: '포스팅 수',
      dataIndex: 'total_posts',
      key: 'total_posts',
    },
    {
      title: '고유 계정 수',
      dataIndex: 'unique_accounts',
      key: 'unique_accounts',
    },
  ];

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

      {selectedRegion && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="총 포스팅"
                  value={stats.reduce((sum, s) => sum + (s.total_posts || 0), 0)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="고유 계정"
                  value={stats.reduce((sum, s) => sum + (s.unique_accounts || 0), 0)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="감정 분석"
                  value={stats.reduce((sum, s) => sum + (s.sentiment_analyses || 0), 0)}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="위험 분류"
                  value={stats.reduce((sum, s) => sum + (s.risk_classifications || 0), 0)}
                />
              </Card>
            </Col>
          </Row>

          <Card title={`${selectedRegion} 상세 통계`}>
            <Table
              columns={columns}
              dataSource={stats}
              loading={loading}
              rowKey={(record, index) => `${index}-${record.sentiment_category}-${record.risk_category}`}
              pagination={false}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Regions;

