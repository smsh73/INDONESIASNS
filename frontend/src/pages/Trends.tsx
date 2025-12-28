import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Input, Select, Row, Col, Statistic, message, Tag } from 'antd';
import { SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import './Trends.css';

const { Option } = Select;

const Trends: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);
  const [influentialUsers, setInfluentialUsers] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');

  useEffect(() => {
    fetchTrends();
    fetchInfluentialUsers();
  }, []);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (selectedPlatform) params.platform = selectedPlatform;

      const response = await api.get('/trends', { params });
      setTrends(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('트렌드 데이터를 불러오는데 실패했습니다');
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInfluentialUsers = async () => {
    try {
      const response = await api.get('/trends/influential?limit=20');
      setInfluentialUsers(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('영향력 있는 사용자 데이터를 불러오는데 실패했습니다');
      setInfluentialUsers([]);
    }
  };

  const handleAnalyzeTrend = async () => {
    try {
      if (!searchKeyword) {
        message.warning('키워드를 입력해주세요');
        return;
      }

      setLoading(true);
      await api.post('/trends/analyze', {
        keyword: searchKeyword,
        platform: selectedPlatform || null,
        days: 7,
      });
      message.success('트렌드 분석이 시작되었습니다');
      fetchTrends();
    } catch (error: any) {
      message.error('트렌드 분석에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const trendColumns = [
    {
      title: '키워드',
      dataIndex: 'keyword',
      key: 'keyword',
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
    },
    {
      title: '멘션 수',
      dataIndex: 'mention_count',
      key: 'mention_count',
    },
    {
      title: '트렌드 방향',
      dataIndex: 'trend_direction',
      key: 'trend_direction',
      render: (direction: string) => {
        const colors: Record<string, string> = {
          up: 'red',
          down: 'blue',
          stable: 'default',
        };
        return <Tag color={colors[direction] || 'default'}>{direction}</Tag>;
      },
    },
    {
      title: '기간',
      key: 'period',
      render: (_: any, record: any) => 
        `${new Date(record.period_start).toLocaleDateString()} - ${new Date(record.period_end).toLocaleDateString()}`,
    },
  ];

  const influentialColumns = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
    },
    {
      title: '팔로워 수',
      dataIndex: 'follower_count',
      key: 'follower_count',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '포스팅 수',
      dataIndex: 'post_count',
      key: 'post_count',
    },
    {
      title: '총 참여도',
      dataIndex: 'total_engagement',
      key: 'total_engagement',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '참여율',
      dataIndex: 'engagement_rate',
      key: 'engagement_rate',
      render: (rate: number) => {
        const numRate = typeof rate === 'number' ? rate : parseFloat(rate) || 0;
        return `${numRate.toFixed(2)}%`;
      },
    },
    {
      title: '영향력 점수',
      dataIndex: 'influence_score',
      key: 'influence_score',
      render: (score: number) => {
        const numScore = typeof score === 'number' ? score : parseFloat(score) || 0;
        return `${(numScore * 100).toFixed(2)}`;
      },
    },
    {
      title: '위험 멘션',
      dataIndex: 'risk_mentions_count',
      key: 'risk_mentions_count',
      render: (count: number) => (
        <Tag color={count > 0 ? 'red' : 'green'}>{count}</Tag>
      ),
    },
  ];

  return (
    <div className="trends">
      <h1>트렌드 분석</h1>

      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="키워드 검색"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={fetchTrends}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="플랫폼"
              value={selectedPlatform || undefined}
              onChange={setSelectedPlatform}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchTrends}>
              검색
            </Button>
          </Col>
          <Col span={4}>
            <Button icon={<ExportOutlined />} onClick={handleAnalyzeTrend}>
              분석 시작
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="트렌드 목록">
            <Table
              columns={trendColumns}
              dataSource={trends}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="영향력 있는 사용자 (상위 20명)">
            <Table
              columns={influentialColumns}
              dataSource={influentialUsers}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Trends;

