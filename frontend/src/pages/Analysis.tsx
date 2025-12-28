import React, { useEffect, useState } from 'react';
import { Table, Card, Select, Input, Button, Tag, Space, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Analysis.css';

const { Option } = Select;

interface AnalysisData {
  id: number;
  content: string;
  platform: string;
  sentiment_category: string;
  risk_category: string;
  risk_level: string;
  created_at: string;
}

const Analysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData[]>([]);
  const [filters, setFilters] = useState({
    sentiment: '',
    risk: '',
    region: '',
  });

  useEffect(() => {
    fetchAnalysis();
  }, [filters]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.risk) params.risk = filters.risk;
      if (filters.region) params.region = filters.region;

      const response = await api.get('/analysis', { params });
      setData(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('분석 데이터를 불러오는데 실패했습니다');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => text?.substring(0, 100) + '...',
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
    },
    {
      title: '감정',
      dataIndex: 'sentiment_category',
      key: 'sentiment_category',
      width: 120,
      render: (category: string) => {
        const colors: Record<string, string> = {
          positive: 'green',
          negative: 'red',
          neutral: 'default',
          hot: 'orange',
          angry: 'volcano',
          concerned: 'purple',
        };
        return <Tag color={colors[category] || 'default'}>{category}</Tag>;
      },
    },
    {
      title: '위험 카테고리',
      dataIndex: 'risk_category',
      key: 'risk_category',
      width: 150,
    },
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
      title: '지역',
      key: 'location',
      width: 150,
      render: (_: any, record: any) => {
        if (record.province) {
          return `${record.province}${record.city ? `, ${record.city}` : ''}`;
        }
        return '-';
      },
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
  ];

  return (
    <div className="analysis">
      <h1>분석 결과</h1>

      <Card style={{ marginBottom: '24px' }}>
        <Space size="middle">
          <Select
            placeholder="감정 필터"
            style={{ width: 150 }}
            allowClear
            value={filters.sentiment || undefined}
            onChange={(value) => setFilters({ ...filters, sentiment: value || '' })}
          >
            <Option value="positive">긍정</Option>
            <Option value="negative">부정</Option>
            <Option value="neutral">중립</Option>
            <Option value="hot">뜨거운</Option>
            <Option value="angry">화남</Option>
            <Option value="concerned">걱정</Option>
          </Select>

          <Select
            placeholder="위험 필터"
            style={{ width: 150 }}
            allowClear
            value={filters.risk || undefined}
            onChange={(value) => setFilters({ ...filters, risk: value || '' })}
          >
            <Option value="terrorism">테러</Option>
            <Option value="crime">범죄</Option>
            <Option value="protest">시위</Option>
            <Option value="accident">사고</Option>
            <Option value="emergency">긴급상황</Option>
            <Option value="action_risk">행동위험</Option>
            <Option value="incident">사태</Option>
            <Option value="riot">소요</Option>
          </Select>

          <Button
            icon={<SearchOutlined />}
            onClick={fetchAnalysis}
          >
            검색
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
};

export default Analysis;

