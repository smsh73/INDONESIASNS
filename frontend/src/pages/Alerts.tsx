import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Space, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Alerts.css';

interface Alert {
  id: number;
  title: string;
  message: string;
  severity: string;
  resolved: boolean;
  created_at: string;
}

const Alerts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/alerts');
      setAlerts(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('알림을 불러오는데 실패했습니다');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await api.put(`/alerts/${id}`, { resolved: true });
      message.success('알림이 해결 처리되었습니다');
      fetchAlerts();
    } catch (error: any) {
      message.error('처리 실패');
    }
  };

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '메시지',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '심각도',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => {
        const colors: Record<string, string> = {
          low: 'green',
          medium: 'orange',
          high: 'red',
          critical: 'volcano',
        };
        return <Tag color={colors[severity] || 'default'}>{severity}</Tag>;
      },
    },
    {
      title: '상태',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 100,
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'red'}>
          {resolved ? '해결됨' : '미해결'}
        </Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '작업',
      key: 'action',
      width: 120,
      render: (_: any, record: Alert) => (
        <Space>
          {!record.resolved && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleResolve(record.id)}
            >
              해결
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="alerts">
      <h1>알림</h1>

      <Card>
        <Table
          columns={columns}
          dataSource={alerts}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
};

export default Alerts;

