import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, message, Breadcrumb } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined,
  CommentOutlined,
  LikeOutlined,
  WarningOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../services/api';
import './Dashboard.css';

interface DashboardStats {
  totalPosts: number;
  totalMentions: number;
  sentimentDistribution: Record<string, number>;
  riskDistribution: Record<string, number>;
  recentAlerts: any[];
  platformDistribution: Array<{ platform: string; count: number }>;
  regionDistribution: Array<{ province: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#52c41a',
  negative: '#ff4d4f',
  neutral: '#8c8c8c',
  hot: '#fa8c16',
  angry: '#cf1322',
  concerned: '#722ed1',
};

const RISK_COLORS: Record<string, string> = {
  terrorism: '#cf1322',
  crime: '#ff4d4f',
  protest: '#fa8c16',
  accident: '#faad14',
  emergency: '#f5222d',
  action_risk: '#eb2f96',
  incident: '#fa541c',
  riot: '#a8071a',
  reaction: '#595959',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [sentimentData, setSentimentData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, trendsRes, sentimentRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/trends?days=7'),
        api.get('/dashboard/sentiment?days=7'),
      ]);

      setStats(statsRes.data?.data || null);
      setTrends(Array.isArray(trendsRes.data?.data) ? trendsRes.data.data : []);
      setSentimentData(Array.isArray(sentimentRes.data?.data) ? sentimentRes.data.data : []);
    } catch (error: any) {
      message.error('데이터를 불러오는데 실패했습니다');
      setStats(null);
      setTrends([]);
      setSentimentData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSentimentClick = (sentiment: string) => {
    navigate(`/dashboard/sentiment/${sentiment}`);
  };

  const handleRiskClick = (risk: string) => {
    navigate(`/dashboard/risk/${risk}`);
  };

  const handlePlatformClick = (platform: string) => {
    navigate(`/dashboard/platform/${platform}`);
  };

  const handleRegionClick = (region: string) => {
    navigate(`/dashboard/region/${region}`);
  };

  const handleHourClick = (hour: number) => {
    navigate(`/dashboard/hour/${hour}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const sentimentChartData = stats
    ? Object.entries(stats.sentimentDistribution).map(([name, value]) => ({
        name,
        value,
        color: SENTIMENT_COLORS[name] || COLORS[0],
      }))
    : [];

  const riskChartData = stats
    ? Object.entries(stats.riskDistribution).map(([name, value]) => ({
        name,
        value,
        color: RISK_COLORS[name] || COLORS[0],
      }))
    : [];

  return (
    <div className="dashboard">
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>홈</Breadcrumb.Item>
        <Breadcrumb.Item>대시보드</Breadcrumb.Item>
      </Breadcrumb>

      <h1>대시보드</h1>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            hoverable
            onClick={() => navigate('/analysis')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="총 포스팅"
              value={stats?.totalPosts || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            hoverable
            onClick={() => navigate('/analysis')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="총 멘션"
              value={stats?.totalMentions || 0}
              prefix={<CommentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            hoverable
            onClick={() => handleSentimentClick('positive')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="긍정 반응"
              value={stats?.sentimentDistribution?.positive || 0}
              prefix={<LikeOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            hoverable
            onClick={() => navigate('/alerts')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="위험 알림"
              value={stats?.recentAlerts?.length || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            title="트렌드 (최근 7일)"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/analysis')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="포스팅 수" />
                <Area type="monotone" dataKey="accounts_count" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} name="계정 수" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="감정 분포"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/sentiment')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => {
                    const numPercent = typeof percent === 'number' ? percent : parseFloat(percent) || 0;
                    return `${name} ${(numPercent * 100).toFixed(0)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(data) => handleSentimentClick(data.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {sentimentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="위험 카테고리 분포"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/risk')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  fill="#8884d8"
                  onClick={(data) => handleRiskClick(data.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="플랫폼별 분포"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/platform')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.platformDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="count" 
                  fill="#8884d8"
                  onClick={(data) => handlePlatformClick(data.platform)}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="지역별 분포 (상위 10개)"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/regions')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.regionDistribution || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="province" type="category" width={100} />
                <Tooltip />
                <Bar 
                  dataKey="count" 
                  fill="#82ca9d"
                  onClick={(data) => handleRegionClick(data.province)}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="시간대별 활동 (최근 7일)"
            extra={<span style={{ cursor: 'pointer' }} onClick={() => navigate('/dashboard/hour')}>더보기 <ArrowRightOutlined /></span>}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats?.hourlyDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6, onClick: (data: any) => handleHourClick(data.hour) }}
                  style={{ cursor: 'pointer' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="감정 분석 상세">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sentiment_category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="count" 
                  fill="#8884d8" 
                  name="수량"
                  onClick={(data) => handleSentimentClick(data.sentiment_category)}
                  style={{ cursor: 'pointer' }}
                />
                <Bar 
                  dataKey="avg_confidence" 
                  fill="#82ca9d" 
                  name="평균 신뢰도"
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="최근 위험 알림">
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {stats?.recentAlerts?.length ? (
                stats.recentAlerts.map((alert: any) => (
                  <Card
                    key={alert.id}
                    size="small"
                    style={{ marginBottom: '8px', cursor: 'pointer' }}
                    onClick={() => navigate(`/alerts?id=${alert.id}`)}
                    hoverable
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{alert.title}</strong>
                        <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                          {new Date(alert.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: alert.severity === 'critical' ? '#ff4d4f' : 
                                         alert.severity === 'high' ? '#ff7875' :
                                         alert.severity === 'medium' ? '#ffa940' : '#52c41a',
                          color: 'white',
                          fontSize: '12px',
                        }}
                      >
                        {alert.severity}
                      </span>
                    </div>
                  </Card>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
                  알림이 없습니다
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
