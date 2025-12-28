import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Statistic, Row, Col, Select, DatePicker, Space, Button, message } from 'antd';
import { BarChartOutlined, TagOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import api from '../services/api';
import './MonitoringStatistics.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface KeywordStat {
  keyword_id: number;
  keyword: string;
  keyword_type: string | null;
  platform: string | null;
  match_count: number;
  match_count_7d: number;
  match_count_30d: number;
  avg_priority_score: number;
  max_priority_score: number;
}

interface HashtagStat {
  hashtag_id: number;
  hashtag: string;
  platform: string | null;
  match_count: number;
  match_count_7d: number;
  match_count_30d: number;
  avg_priority_score: number;
  max_priority_score: number;
}

const MonitoringStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keywordStats, setKeywordStats] = useState<KeywordStat[]>([]);
  const [hashtagStats, setHashtagStats] = useState<HashtagStat[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, [selectedPlatform, dateRange]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (selectedPlatform) {
        params.platform = selectedPlatform;
      }
      
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const [keywordsRes, hashtagsRes] = await Promise.all([
        api.get('/monitoring/statistics/keywords', { params }),
        api.get('/monitoring/statistics/hashtags', { params }),
      ]);

      setKeywordStats(Array.isArray(keywordsRes.data?.data) ? keywordsRes.data.data : []);
      setHashtagStats(Array.isArray(hashtagsRes.data?.data) ? hashtagsRes.data.data : []);
    } catch (error: any) {
      message.error('통계 데이터를 불러오는데 실패했습니다');
      setKeywordStats([]);
      setHashtagStats([]);
    } finally {
      setLoading(false);
    }
  };

  const keywordColumns = [
    {
      title: '키워드',
      dataIndex: 'keyword',
      key: 'keyword',
      render: (keyword: string, record: KeywordStat) => (
        <Space>
          <Tag color="blue">{keyword}</Tag>
          {record.keyword_type && (
            <Tag color={
              record.keyword_type === 'region' ? 'green' :
              record.keyword_type === 'organization' ? 'purple' :
              record.keyword_type === 'person' ? 'orange' :
              record.keyword_type === 'product' ? 'cyan' :
              record.keyword_type === 'event' ? 'red' : 'default'
            }>
              {record.keyword_type === 'region' ? '지역' :
               record.keyword_type === 'organization' ? '기관명' :
               record.keyword_type === 'person' ? '인물명' :
               record.keyword_type === 'product' ? '제품명' :
               record.keyword_type === 'event' ? '이벤트' : '기타'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string | null) => platform || <Tag>전체</Tag>,
    },
    {
      title: '총 매칭',
      dataIndex: 'match_count',
      key: 'match_count',
      sorter: (a: KeywordStat, b: KeywordStat) => a.match_count - b.match_count,
      render: (count: number) => <strong>{count}</strong>,
    },
    {
      title: '최근 7일',
      dataIndex: 'match_count_7d',
      key: 'match_count_7d',
      sorter: (a: KeywordStat, b: KeywordStat) => a.match_count_7d - b.match_count_7d,
    },
    {
      title: '최근 30일',
      dataIndex: 'match_count_30d',
      key: 'match_count_30d',
      sorter: (a: KeywordStat, b: KeywordStat) => a.match_count_30d - b.match_count_30d,
    },
    {
      title: '평균 우선순위',
      dataIndex: 'avg_priority_score',
      key: 'avg_priority_score',
      sorter: (a: KeywordStat, b: KeywordStat) => (a.avg_priority_score || 0) - (b.avg_priority_score || 0),
      render: (score: number) => {
        const numScore = typeof score === 'number' ? score : parseFloat(score);
        return numScore && !isNaN(numScore) ? numScore.toFixed(1) : '-';
      },
    },
    {
      title: '최대 우선순위',
      dataIndex: 'max_priority_score',
      key: 'max_priority_score',
      sorter: (a: KeywordStat, b: KeywordStat) => (a.max_priority_score || 0) - (b.max_priority_score || 0),
      render: (score: number) => score || '-',
    },
  ];

  const hashtagColumns = [
    {
      title: '해시태그',
      dataIndex: 'hashtag',
      key: 'hashtag',
      render: (hashtag: string) => <Tag color="purple">{hashtag}</Tag>,
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string | null) => platform || <Tag>전체</Tag>,
    },
    {
      title: '총 매칭',
      dataIndex: 'match_count',
      key: 'match_count',
      sorter: (a: HashtagStat, b: HashtagStat) => a.match_count - b.match_count,
      render: (count: number) => <strong>{count}</strong>,
    },
    {
      title: '최근 7일',
      dataIndex: 'match_count_7d',
      key: 'match_count_7d',
      sorter: (a: HashtagStat, b: HashtagStat) => a.match_count_7d - b.match_count_7d,
    },
    {
      title: '최근 30일',
      dataIndex: 'match_count_30d',
      key: 'match_count_30d',
      sorter: (a: HashtagStat, b: HashtagStat) => a.match_count_30d - b.match_count_30d,
    },
    {
      title: '평균 우선순위',
      dataIndex: 'avg_priority_score',
      key: 'avg_priority_score',
      sorter: (a: HashtagStat, b: HashtagStat) => (a.avg_priority_score || 0) - (b.avg_priority_score || 0),
      render: (score: number) => {
        const numScore = typeof score === 'number' ? score : parseFloat(score);
        return numScore && !isNaN(numScore) ? numScore.toFixed(1) : '-';
      },
    },
    {
      title: '최대 우선순위',
      dataIndex: 'max_priority_score',
      key: 'max_priority_score',
      sorter: (a: HashtagStat, b: HashtagStat) => (a.max_priority_score || 0) - (b.max_priority_score || 0),
      render: (score: number) => score || '-',
    },
  ];

  const totalMatches = keywordStats.reduce((sum, stat) => sum + stat.match_count, 0) +
                       hashtagStats.reduce((sum, stat) => sum + stat.match_count, 0);
  const totalMatches7d = keywordStats.reduce((sum, stat) => sum + stat.match_count_7d, 0) +
                         hashtagStats.reduce((sum, stat) => sum + stat.match_count_7d, 0);
  const totalMatches30d = keywordStats.reduce((sum, stat) => sum + stat.match_count_30d, 0) +
                          hashtagStats.reduce((sum, stat) => sum + stat.match_count_30d, 0);

  return (
    <div className="monitoring-statistics">
      <Card
        title={
          <Space>
            <BarChartOutlined />
            <span>모니터링 통계</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="플랫폼 필터"
              value={selectedPlatform || undefined}
              onChange={setSelectedPlatform}
              allowClear
              style={{ width: 150 }}
            >
              <Option value="facebook">Facebook</Option>
              <Option value="instagram">Instagram</Option>
              <Option value="tiktok">TikTok</Option>
              <Option value="linkedin">LinkedIn</Option>
            </Select>
            <RangePicker
              onChange={(dates) => setDateRange(dates as [any, any])}
              format="YYYY-MM-DD"
            />
            <Button onClick={fetchStatistics}>새로고침</Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="총 매칭 수"
                value={totalMatches}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="최근 7일 매칭"
                value={totalMatches7d}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="최근 30일 매칭"
                value={totalMatches30d}
                prefix={<SearchOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="활성 키워드"
                value={keywordStats.length}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>키워드 매칭 통계</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
            <Table
              columns={keywordColumns}
              dataSource={keywordStats}
              rowKey="keyword_id"
              loading={loading}
            pagination={{ pageSize: 10 }}
          />
                </Card>

        <Card
          title={
            <Space>
              <TagOutlined />
              <span>해시태그 매칭 통계</span>
            </Space>
          }
        >
            <Table
              columns={hashtagColumns}
              dataSource={hashtagStats}
              rowKey="hashtag_id"
              loading={loading}
            pagination={{ pageSize: 10 }}
            />
        </Card>
      </Card>
    </div>
  );
};

export default MonitoringStatistics;
