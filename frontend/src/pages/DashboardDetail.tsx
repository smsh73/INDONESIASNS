import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Row, Col, Card, Statistic, Spin, message, Breadcrumb, 
  Table, Tag, Button, Pagination, DatePicker, Select 
} from 'antd';
import { ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import './DashboardDetail.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface DetailStats {
  posts: any[];
  stats: any;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

const DashboardDetail: React.FC = () => {
  const { type, value } = useParams<{ type: string; value: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailStats | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (type && value) {
      fetchDetailData();
    }
  }, [type, value, days, currentPage]);

  const fetchDetailData = async () => {
    try {
      setLoading(true);
      let endpoint = '';
      
      if (type === 'sentiment') {
        endpoint = `/dashboard/sentiment/${value}/detail?days=${days}&page=${currentPage}&limit=20`;
      } else if (type === 'risk') {
        endpoint = `/dashboard/risk/${value}/detail?days=${days}&page=${currentPage}&limit=20`;
      } else if (type === 'platform') {
        const trendsRes = await api.get(`/dashboard/platform/${value}?days=${days}`);
        setTrends(trendsRes.data.data);
        setLoading(false);
        return;
      } else if (type === 'region') {
        const trendsRes = await api.get(`/dashboard/region/${value}?days=${days}`);
        setTrends(trendsRes.data.data);
        setLoading(false);
        return;
      } else if (type === 'hour') {
        const trendsRes = await api.get(`/dashboard/hour/${value}?days=${days}`);
        setTrends(trendsRes.data.data);
        setLoading(false);
        return;
      }

      if (endpoint) {
        const response = await api.get(endpoint);
        setData(response.data.data);
      }
    } catch (error: any) {
      message.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (type === 'sentiment') {
      const sentimentNames: Record<string, string> = {
        positive: '긍정',
        negative: '부정',
        neutral: '중립',
        hot: '뜨거운',
        angry: '화남',
        concerned: '걱정',
      };
      return `감정 분석: ${value ? (sentimentNames[value] || value) : 'N/A'}`;
    } else if (type === 'risk') {
      const riskNames: Record<string, string> = {
        terrorism: '테러',
        crime: '범죄',
        protest: '시위',
        accident: '사고',
        emergency: '긴급상황',
        action_risk: '행동위험',
        incident: '사태',
        riot: '소요',
        reaction: '반응',
      };
      return `위험 분석: ${value ? (riskNames[value] || value) : 'N/A'}`;
    } else if (type === 'platform') {
      return `플랫폼 분석: ${value}`;
    } else if (type === 'region') {
      return `지역 분석: ${value}`;
    } else if (type === 'hour') {
      return `시간대 분석: ${value}시`;
    }
    return '상세 분석';
  };

  const columns = [
    {
      title: '내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => text?.substring(0, 100) + (text?.length > 100 ? '...' : ''),
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
    },
    {
      title: '계정',
      dataIndex: 'account_username',
      key: 'account_username',
      width: 120,
    },
    ...(type === 'sentiment' ? [{
      title: '신뢰도',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 100,
      render: (score: number) => {
        const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
        return `${(numScore * 100).toFixed(1)}%`;
      },
    }] : []),
    ...(type === 'risk' ? [
      {
        title: '위험 수준',
        dataIndex: 'risk_level',
        key: 'risk_level',
        width: 100,
        render: (level: string) => {
          const colors: Record<string, string> = {
            low: 'green',
            medium: 'orange',
            high: 'red',
            critical: 'volcano',
          };
          return <Tag color={colors[level] || 'default'}>{level}</Tag>;
        },
      },
      {
        title: '신뢰도',
        dataIndex: 'confidence_score',
        key: 'confidence_score',
        width: 100,
        render: (score: number) => {
        const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
        return `${(numScore * 100).toFixed(1)}%`;
      },
      },
    ] : []),
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dashboard-detail">
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <a onClick={() => navigate('/')}>홈</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <a onClick={() => navigate('/')}>대시보드</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{getTitle()}</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ marginRight: '16px' }}
          >
            뒤로
          </Button>
          <h1 style={{ margin: 0, display: 'inline' }}>{getTitle()}</h1>
        </div>
        <div>
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 120, marginRight: '8px' }}
          >
            <Option value={1}>1일</Option>
            <Option value={7}>7일</Option>
            <Option value={30}>30일</Option>
            <Option value={90}>90일</Option>
          </Select>
          <Button 
            icon={<ExportOutlined />}
            onClick={async () => {
              try {
                const response = await api.get(
                  `/export/dashboard/${type}/${value}`,
                  {
                    params: { days, format: 'excel' },
                    responseType: 'blob',
                  }
                );
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${type}_${value}_${days}days.xlsx`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                message.success('파일 다운로드가 시작되었습니다');
              } catch (error: any) {
                message.error('내보내기에 실패했습니다');
              }
            }}
          >
            내보내기
          </Button>
        </div>
      </div>

      {data && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="총 포스팅"
                  value={data.stats?.total || 0}
                />
              </Card>
            </Col>
            {type === 'sentiment' && (
              <>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="평균 신뢰도"
                      value={data.stats?.avg_confidence ? `${(parseFloat(data.stats.avg_confidence) * 100).toFixed(1)}%` : '0%'}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="고유 계정"
                      value={data.stats?.unique_accounts || 0}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="플랫폼 수"
                      value={data.stats?.platforms_count || 0}
                    />
                  </Card>
                </Col>
              </>
            )}
            {type === 'risk' && (
              <>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="Critical"
                      value={data.stats?.critical_count || 0}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="High"
                      value={data.stats?.high_count || 0}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card>
                    <Statistic
                      title="평균 신뢰도"
                      value={data.stats?.avg_confidence ? `${(parseFloat(data.stats.avg_confidence) * 100).toFixed(1)}%` : '0%'}
                    />
                  </Card>
                </Col>
              </>
            )}
          </Row>

          <Card title="포스팅 목록">
            <Table
              columns={columns}
              dataSource={data.posts}
              rowKey="id"
              pagination={false}
              onRow={(record) => ({
                onClick: () => navigate(`/posts/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <Pagination
                current={currentPage}
                total={data.pagination.total}
                pageSize={data.pagination.limit}
                onChange={setCurrentPage}
                showSizeChanger={false}
              />
            </div>
          </Card>
        </>
      )}

      {(type === 'platform' || type === 'region' || type === 'hour') && trends.length > 0 && (
        <Card title="트렌드 분석">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="post_count" stroke="#8884d8" name="포스팅 수" />
              <Line type="monotone" dataKey="account_count" stroke="#82ca9d" name="계정 수" />
              {type === 'platform' && (
                <Line type="monotone" dataKey="total_engagement" stroke="#ffc658" name="총 참여도" />
              )}
              {type === 'hour' && (
                <>
                  <Line type="monotone" dataKey="positive_count" stroke="#52c41a" name="긍정" />
                  <Line type="monotone" dataKey="negative_count" stroke="#ff4d4f" name="부정" />
                  <Line type="monotone" dataKey="high_risk_count" stroke="#cf1322" name="고위험" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default DashboardDetail;

