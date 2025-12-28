import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Tag, message, Select, Space } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import './CollectionJobs.css';

const { Option } = Select;

interface CollectionJob {
  id: number;
  platform: string;
  job_type: string;
  status: string;
  items_collected: number;
  error_message: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

const CollectionJobs: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<CollectionJob[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  useEffect(() => {
    fetchJobs();
  }, [selectedPlatform]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedPlatform) params.platform = selectedPlatform;

      const response = await api.get('/collection/jobs', { params });
      setJobs(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('수집 작업 목록을 불러오는데 실패했습니다');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async (platform: string) => {
    try {
      await api.post('/collection/jobs', {
        platform,
        jobType: 'posts',
      });
      message.success('수집 작업이 시작되었습니다');
      fetchJobs();
    } catch (error: any) {
      message.error('수집 작업 시작에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => <Tag>{platform}</Tag>,
    },
    {
      title: '작업 타입',
      dataIndex: 'job_type',
      key: 'job_type',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          completed: 'green',
          running: 'blue',
          failed: 'red',
          pending: 'orange',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '수집 항목 수',
      dataIndex: 'items_collected',
      key: 'items_collected',
    },
    {
      title: '시작 시간',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    {
      title: '완료 시간',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (date: string) => date ? new Date(date).toLocaleString('ko-KR') : '-',
    },
    {
      title: '에러 메시지',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
    },
  ];

  return (
    <div className="collection-jobs">
      <Card
        title="수집 작업 관리"
        extra={
          <Space>
            <Select
              placeholder="플랫폼 필터"
              value={selectedPlatform || undefined}
              onChange={setSelectedPlatform}
              allowClear
              style={{ width: 150 }}
            >
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartJob('instagram')}
            >
              Instagram 수집 시작
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartJob('facebook')}
            >
              Facebook 수집 시작
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={jobs}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
};

export default CollectionJobs;

