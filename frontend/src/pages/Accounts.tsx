import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, message, Tag, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Accounts.css';

const { Option } = Select;

interface Account {
  id: number;
  username: string;
  platform: string;
  is_official: boolean;
  follower_count: number;
  is_active: boolean;
  created_at: string;
}

const Accounts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/accounts');
      setAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (error: any) {
      message.error('계정 목록을 불러오는데 실패했습니다');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAccount(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    form.setFieldsValue({
      username: account.username,
      platform: account.platform,
      isOfficial: account.is_official,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/accounts/${id}`);
      message.success('계정이 삭제되었습니다');
      fetchAccounts();
    } catch (error: any) {
      message.error('계정 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingAccount) {
        await api.put(`/accounts/${editingAccount.id}`, values);
        message.success('계정이 수정되었습니다');
      } else {
        await api.post('/accounts', values);
        message.success('계정이 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchAccounts();
    } catch (error: any) {
      message.error(editingAccount ? '계정 수정에 실패했습니다' : '계정 생성에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => <Tag>{platform}</Tag>,
    },
    {
      title: '공식 계정',
      dataIndex: 'is_official',
      key: 'is_official',
      render: (isOfficial: boolean) => (
        <Tag color={isOfficial ? 'green' : 'default'}>
          {isOfficial ? '예' : '아니오'}
        </Tag>
      ),
    },
    {
      title: '팔로워 수',
      dataIndex: 'follower_count',
      key: 'follower_count',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: Account) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="accounts">
      <Card
        title="계정 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            계정 추가
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={accounts}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingAccount ? '계정 수정' : '계정 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText={editingAccount ? '수정' : '생성'}
        cancelText="취소"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="username"
            label="사용자명"
            rules={[{ required: true, message: '사용자명을 입력해주세요' }]}
          >
            <Input placeholder="사용자명" />
          </Form.Item>

          <Form.Item
            name="platform"
            label="플랫폼"
            rules={[{ required: true, message: '플랫폼을 선택해주세요' }]}
          >
            <Select placeholder="플랫폼 선택">
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
              <Option value="whatsapp">WhatsApp</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isOfficial"
            label="공식 계정"
            valuePropName="checked"
          >
            <Select placeholder="공식 계정 여부">
              <Option value="true">예</Option>
              <Option value="false">아니오</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Accounts;

