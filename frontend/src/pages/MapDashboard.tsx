import React, { useEffect, useState } from 'react';
import { Card, Select, Row, Col, Statistic, message, Spin, Tag } from 'antd';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import './MapDashboard.css';

const { Option } = Select;

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      fetchMapDashboard();
    }
  }, [selectedCountry, days]);

  const fetchCountries = async () => {
    try {
      const response = await api.get('/admin/countries');
      setCountries(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedCountry(response.data.data[0].id);
      }
    } catch (error: any) {
      message.error('국가 목록을 불러오는데 실패했습니다');
    }
  };

  const fetchMapDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/map/dashboard', {
        params: { countryId: selectedCountry, days },
      });
      setMapData(response.data?.data || null);
    } catch (error: any) {
      message.error('지도 대시보드를 불러오는데 실패했습니다');
      setMapData(null);
    } finally {
      setLoading(false);
    }
  };

  const getColorByStats = (stats: any) => {
    if (!stats) return '#888888';
    const riskRatio = stats.high_risk_count / (stats.post_count || 1);
    if (riskRatio > 0.1) return '#cf1322';
    if (riskRatio > 0.05) return '#fa8c16';
    if (stats.positive_count > stats.negative_count) return '#52c41a';
    return '#1890ff';
  };

  if (loading && !mapData) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const center: [number, number] = mapData?.country
    ? [mapData.country.latitude || -0.7893, mapData.country.longitude || 113.9213]
    : [-0.7893, 113.9213];

  return (
    <div className="map-dashboard">
      <Card
        title="지역별 지도 대시보드"
        extra={
          <Select
            value={selectedCountry}
            onChange={setSelectedCountry}
            style={{ width: 200, marginRight: 16 }}
          >
            {countries.map((c) => (
              <Option key={c.id} value={c.id}>
                {c.name}
              </Option>
            ))}
          </Select>
        }
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="총 포스팅"
                value={mapData?.regions?.reduce((sum: number, r: any) => sum + (r.stats?.post_count || 0), 0) || 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="총 멘션"
                value={mapData?.regions?.reduce((sum: number, r: any) => sum + (r.stats?.mention_count || 0), 0) || 0}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="긍정 반응"
                value={mapData?.regions?.reduce((sum: number, r: any) => sum + (r.stats?.positive_count || 0), 0) || 0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="고위험"
                value={mapData?.regions?.reduce((sum: number, r: any) => sum + (r.stats?.high_risk_count || 0), 0) || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <div style={{ height: '600px', width: '100%' }}>
            <MapContainer
              center={center}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapData?.regions?.map((region: any) => {
                if (!region.latitude || !region.longitude) return null;
                
                return (
                  <Marker
                    key={region.id}
                    position={[region.latitude, region.longitude]}
                    icon={L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="
                        background-color: ${getColorByStats(region.stats)};
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                      "></div>`,
                      iconSize: [20, 20],
                    })}
                  >
                    <Popup>
                      <div>
                        <h3>{region.province} {region.city || ''}</h3>
                        <p>포스팅: {region.stats?.post_count || 0}</p>
                        <p>멘션: {region.stats?.mention_count || 0}</p>
                        <p>긍정: {region.stats?.positive_count || 0}</p>
                        <p>부정: {region.stats?.negative_count || 0}</p>
                        <p>고위험: {region.stats?.high_risk_count || 0}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </Card>

        <Card title="지역별 통계" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            {mapData?.regions?.map((region: any) => (
              <Col xs={24} sm={12} lg={8} key={region.id}>
                <Card size="small">
                  <h4>{region.province} {region.city || ''}</h4>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Statistic title="포스팅" value={region.stats?.post_count || 0} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="멘션" value={region.stats?.mention_count || 0} />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="긍정"
                        value={region.stats?.positive_count || 0}
                        valueStyle={{ color: '#3f8600', fontSize: '14px' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="고위험"
                        value={region.stats?.high_risk_count || 0}
                        valueStyle={{ color: '#cf1322', fontSize: '14px' }}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Card>
    </div>
  );
};

export default MapDashboard;

