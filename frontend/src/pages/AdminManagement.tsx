import React, { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Space,
  Popconfirm,
  Switch,
  InputNumber,
  Badge,
  Tooltip,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import './AdminManagement.css';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface ApiKey {
  id: number;
  name: string;
  service: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Keyword {
  id: number;
  keyword: string;
  platform: string | null;
  priority: number;
  is_active: boolean;
  description?: string;
  keyword_type?: string | null;
}

interface Hashtag {
  id: number;
  hashtag: string;
  platform: string | null;
  priority: number;
  is_active: boolean;
  description?: string;
}

interface Account {
  id: number;
  username: string;
  platform: string;
  is_official: boolean;
  is_active: boolean;
  follower_count: number;
  keyword_count?: number;
  hashtag_count?: number;
}

const AdminManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="admin-management">
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>모니터링 설정 관리</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
          >
            새로고침
          </Button>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="AI API Keys" key="api-keys">
            <ApiKeysManagement />
          </TabPane>
          <TabPane tab="모니터링 키워드" key="keywords">
            <KeywordsManagement />
          </TabPane>
          <TabPane tab="모니터링 해시태그" key="hashtags">
            <HashtagsManagement />
          </TabPane>
          <TabPane tab="SNS 계정 관리" key="accounts">
            <AccountsManagement />
          </TabPane>
          <TabPane tab="모니터링 상태" key="monitoring-status">
            <MonitoringStatus />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

// AI API Keys 관리
const ApiKeysManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/api-keys');
      setApiKeys(response.data.data);
    } catch (error: any) {
      message.error('API 키 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingKey(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    form.setFieldsValue({
      name: key.name,
      service: key.service,
      isActive: key.is_active,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/api-keys/${id}`);
      message.success('API 키가 삭제되었습니다');
      fetchApiKeys();
    } catch (error: any) {
      message.error('API 키 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingKey) {
        await api.put(`/admin/api-keys/${editingKey.id}`, values);
        message.success('API 키가 수정되었습니다');
      } else {
        await api.post('/admin/api-keys', values);
        message.success('API 키가 등록되었습니다');
      }
      setIsModalVisible(false);
      fetchApiKeys();
    } catch (error: any) {
      message.error(error.response?.data?.message || '저장에 실패했습니다');
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/api-keys/${id}`, { isActive: !currentStatus });
      message.success('상태가 변경되었습니다');
      fetchApiKeys();
    } catch (error: any) {
      message.error('상태 변경에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '서비스',
      dataIndex: 'service',
      key: 'service',
      render: (service: string) => (
        <Tag color={service === 'openai' ? 'blue' : 'green'}>{service.toUpperCase()}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '활성' : '비활성'}
        />
      ),
    },
    {
      title: '생성일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '액션',
      key: 'actions',
      render: (_: any, record: ApiKey) => (
        <Space>
          <Tooltip title="수정">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? '비활성화' : '활성화'}>
            <Button
              type="link"
              icon={record.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => toggleActive(record.id, record.is_active)}
            />
          </Tooltip>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          API Key 등록
        </Button>
      </div>
      <Table
        dataSource={apiKeys}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingKey ? 'API Key 수정' : 'API Key 등록'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="예: OpenAI Production Key" />
          </Form.Item>
          <Form.Item
            name="service"
            label="서비스"
            rules={[{ required: true, message: '서비스를 선택해주세요' }]}
          >
            <Select placeholder="서비스 선택">
              <Option value="openai">OpenAI</Option>
              <Option value="google">Google</Option>
              <Option value="azure">Azure</Option>
              <Option value="aws">AWS</Option>
              <Option value="other">기타</Option>
            </Select>
          </Form.Item>
          {!editingKey && (
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[{ required: true, message: 'API Key를 입력해주세요' }]}
            >
              <Input.Password placeholder="API Key 입력" />
            </Form.Item>
          )}
          <Form.Item name="isActive" label="활성화" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// 모니터링 키워드 관리
const KeywordsManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/keywords');
      setKeywords(response.data.data);
    } catch (error: any) {
      message.error('키워드 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingKeyword(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    form.setFieldsValue({
      keyword: keyword.keyword,
      platform: keyword.platform,
      priority: keyword.priority,
      description: keyword.description,
      keywordType: keyword.keyword_type,
      isActive: keyword.is_active,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/keywords/${id}`);
      message.success('키워드가 삭제되었습니다');
      fetchKeywords();
    } catch (error: any) {
      message.error('키워드 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingKeyword) {
        await api.put(`/admin/keywords/${editingKeyword.id}`, values);
        message.success('키워드가 수정되었습니다');
      } else {
        await api.post('/admin/keywords', values);
        message.success('키워드가 등록되었습니다');
      }
      setIsModalVisible(false);
      fetchKeywords();
    } catch (error: any) {
      message.error(error.response?.data?.message || '저장에 실패했습니다');
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/keywords/${id}`, { isActive: !currentStatus });
      message.success('상태가 변경되었습니다');
      fetchKeywords();
    } catch (error: any) {
      message.error('상태 변경에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '키워드',
      dataIndex: 'keyword',
      key: 'keyword',
      render: (keyword: string) => <Tag color="blue">{keyword}</Tag>,
    },
    {
      title: '타입',
      dataIndex: 'keyword_type',
      key: 'keyword_type',
      render: (type: string | null) => {
        const typeMap: { [key: string]: { label: string; color: string } } = {
          region: { label: '지역', color: 'green' },
          organization: { label: '기관명', color: 'purple' },
          person: { label: '인물명', color: 'orange' },
          product: { label: '제품명', color: 'cyan' },
          event: { label: '이벤트', color: 'red' },
          other: { label: '기타', color: 'default' },
        };
        const typeInfo = type ? typeMap[type] : null;
        return typeInfo ? <Tag color={typeInfo.color}>{typeInfo.label}</Tag> : <Tag>미지정</Tag>;
      },
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string | null) => platform || <Tag>전체</Tag>,
    },
    {
      title: '우선순위',
      dataIndex: 'priority',
      key: 'priority',
      sorter: (a: Keyword, b: Keyword) => a.priority - b.priority,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '활성' : '비활성'}
        />
      ),
    },
    {
      title: '액션',
      key: 'actions',
      render: (_: any, record: Keyword) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="link"
            icon={record.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
            onClick={() => toggleActive(record.id, record.is_active)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleStartKeywordCollection = async (platform: string) => {
    try {
      await api.post('/monitoring/keyword-based/run-now', { platform });
      message.success(`${platform} 키워드 기반 수집이 시작되었습니다`);
    } catch (error: any) {
      message.error('키워드 기반 수집 시작에 실패했습니다');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button
            type="default"
            icon={<PlayCircleOutlined />}
            onClick={() => handleStartKeywordCollection('facebook')}
          >
            Facebook 키워드 수집
          </Button>
          <Button
            type="default"
            icon={<PlayCircleOutlined />}
            onClick={() => handleStartKeywordCollection('instagram')}
          >
            Instagram 키워드 수집
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          키워드 등록
        </Button>
      </div>
      <Table
        dataSource={keywords}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingKeyword ? '키워드 수정' : '키워드 등록'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="keyword"
            label="키워드"
            rules={[{ required: true, message: '키워드를 입력해주세요' }]}
          >
            <Input placeholder="모니터링할 키워드 입력" />
          </Form.Item>
          <Form.Item name="platform" label="플랫폼">
            <Select placeholder="전체 플랫폼 (선택 안 함)" allowClear>
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
              <Option value="whatsapp">WhatsApp</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="우선순위"
            initialValue={0}
            tooltip="숫자가 높을수록 우선순위가 높습니다"
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="keywordType" label="키워드 타입">
            <Select placeholder="키워드 타입 선택 (지역, 기관명, 인물명, 제품명 등)" allowClear>
              <Option value="region">지역</Option>
              <Option value="organization">기관명</Option>
              <Option value="person">인물명</Option>
              <Option value="product">제품명</Option>
              <Option value="event">이벤트</Option>
              <Option value="other">기타</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="설명">
            <TextArea rows={3} placeholder="키워드에 대한 설명 (선택사항)" />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// 모니터링 해시태그 관리
const HashtagsManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingHashtag, setEditingHashtag] = useState<Hashtag | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchHashtags();
  }, []);

  const fetchHashtags = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/hashtags');
      setHashtags(response.data.data);
    } catch (error: any) {
      message.error('해시태그 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingHashtag(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (hashtag: Hashtag) => {
    setEditingHashtag(hashtag);
    form.setFieldsValue({
      hashtag: hashtag.hashtag,
      platform: hashtag.platform,
      priority: hashtag.priority,
      description: hashtag.description,
      isActive: hashtag.is_active,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/hashtags/${id}`);
      message.success('해시태그가 삭제되었습니다');
      fetchHashtags();
    } catch (error: any) {
      message.error('해시태그 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingHashtag) {
        await api.put(`/admin/hashtags/${editingHashtag.id}`, values);
        message.success('해시태그가 수정되었습니다');
      } else {
        await api.post('/admin/hashtags', values);
        message.success('해시태그가 등록되었습니다');
      }
      setIsModalVisible(false);
      fetchHashtags();
    } catch (error: any) {
      message.error(error.response?.data?.message || '저장에 실패했습니다');
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/hashtags/${id}`, { isActive: !currentStatus });
      message.success('상태가 변경되었습니다');
      fetchHashtags();
    } catch (error: any) {
      message.error('상태 변경에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '해시태그',
      dataIndex: 'hashtag',
      key: 'hashtag',
      render: (hashtag: string) => (
        <Tag color="purple">#{hashtag.replace('#', '')}</Tag>
      ),
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string | null) => platform || <Tag>전체</Tag>,
    },
    {
      title: '우선순위',
      dataIndex: 'priority',
      key: 'priority',
      sorter: (a: Hashtag, b: Hashtag) => a.priority - b.priority,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '활성' : '비활성'}
        />
      ),
    },
    {
      title: '액션',
      key: 'actions',
      render: (_: any, record: Hashtag) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="link"
            icon={record.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
            onClick={() => toggleActive(record.id, record.is_active)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          해시태그 등록
        </Button>
      </div>
      <Table
        dataSource={hashtags}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingHashtag ? '해시태그 수정' : '해시태그 등록'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="hashtag"
            label="해시태그"
            rules={[{ required: true, message: '해시태그를 입력해주세요' }]}
          >
            <Input placeholder="#hashtag (또는 hashtag)" />
          </Form.Item>
          <Form.Item name="platform" label="플랫폼">
            <Select placeholder="전체 플랫폼 (선택 안 함)" allowClear>
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
              <Option value="whatsapp">WhatsApp</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="우선순위"
            initialValue={0}
            tooltip="숫자가 높을수록 우선순위가 높습니다"
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <TextArea rows={3} placeholder="해시태그에 대한 설명 (선택사항)" />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// SNS 계정 관리
const AccountsManagement: React.FC = () => {
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
      const [accountsRes, statusRes] = await Promise.all([
        api.get('/accounts'),
        api.get('/monitoring/status'),
      ]);
      
      const accountsData = accountsRes.data.data;
      const statusData = statusRes.data.data;
      
      // 모니터링 상태 정보 병합
      const merged = accountsData.map((account: Account) => {
        const status = statusData.find((s: any) => s.id === account.id);
        return {
          ...account,
          keyword_count: status?.keyword_count || 0,
          hashtag_count: status?.hashtag_count || 0,
        };
      });
      
      setAccounts(merged);
    } catch (error: any) {
      message.error('계정 목록을 불러오는데 실패했습니다');
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
      isActive: account.is_active,
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
        message.success('계정이 등록되었습니다');
      }
      setIsModalVisible(false);
      fetchAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.message || '저장에 실패했습니다');
    }
  };

  const toggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/accounts/${id}`, { isActive: !currentStatus });
      message.success('상태가 변경되었습니다');
      fetchAccounts();
    } catch (error: any) {
      message.error('상태 변경에 실패했습니다');
    }
  };

  const startMonitoring = async (accountId: number) => {
    try {
      await api.post(`/monitoring/accounts/${accountId}/start`);
      message.success('모니터링이 시작되었습니다');
      fetchAccounts();
    } catch (error: any) {
      message.error('모니터링 시작에 실패했습니다');
    }
  };

  const stopMonitoring = async (accountId: number) => {
    try {
      await api.post(`/monitoring/accounts/${accountId}/stop`);
      message.success('모니터링이 중지되었습니다');
      fetchAccounts();
    } catch (error: any) {
      message.error('모니터링 중지에 실패했습니다');
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
      render: (platform: string) => (
        <Tag color={getPlatformColor(platform)}>{platform.toUpperCase()}</Tag>
      ),
    },
    {
      title: '계정 유형',
      dataIndex: 'is_official',
      key: 'is_official',
      render: (isOfficial: boolean) => (
        <Tag color={isOfficial ? 'gold' : 'default'}>
          {isOfficial ? '공식' : '일반'}
        </Tag>
      ),
    },
    {
      title: '모니터링 설정',
      key: 'monitoring',
      render: (_: any, record: Account) => (
        <Space>
          <Tooltip title={`키워드: ${record.keyword_count || 0}개`}>
            <Tag color="blue">키워드: {record.keyword_count || 0}</Tag>
          </Tooltip>
          <Tooltip title={`해시태그: ${record.hashtag_count || 0}개`}>
            <Tag color="purple">해시태그: {record.hashtag_count || 0}</Tag>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '활성' : '비활성'}
        />
      ),
    },
    {
      title: '액션',
      key: 'actions',
      render: (_: any, record: Account) => (
        <Space>
          <Tooltip title="모니터링 시작">
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => startMonitoring(record.id)}
            />
          </Tooltip>
          <Tooltip title="모니터링 중지">
            <Button
              type="link"
              icon={<StopOutlined />}
              onClick={() => stopMonitoring(record.id)}
            />
          </Tooltip>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          <Button
            type="default"
            icon={<PlayCircleOutlined />}
            onClick={async () => {
              try {
                await api.post('/monitoring/accounts/start-all');
                message.success('모든 계정의 모니터링이 시작되었습니다');
                fetchAccounts();
              } catch (error: any) {
                message.error('모니터링 시작에 실패했습니다');
              }
            }}
          >
            전체 모니터링 시작
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            계정 등록
          </Button>
        </Space>
      </div>
      <Table
        dataSource={accounts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingAccount ? '계정 수정' : '계정 등록'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label="사용자명"
            rules={[{ required: true, message: '사용자명을 입력해주세요' }]}
          >
            <Input placeholder="SNS 사용자명" />
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
          <Form.Item name="isOfficial" label="공식 계정" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// 모니터링 상태
const MonitoringStatus: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any[]>([]);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/monitoring/status');
      setStatus(response.data.data);
    } catch (error: any) {
      message.error('모니터링 상태를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '계정',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color={getPlatformColor(platform)}>{platform.toUpperCase()}</Tag>
      ),
    },
    {
      title: '활성 키워드',
      dataIndex: 'keyword_count',
      key: 'keyword_count',
      render: (count: number) => <Tag color="blue">{count || 0}개</Tag>,
    },
    {
      title: '활성 해시태그',
      dataIndex: 'hashtag_count',
      key: 'hashtag_count',
      render: (count: number) => <Tag color="purple">{count || 0}개</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? '활성' : '비활성'}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchStatus}>
          새로고침
        </Button>
      </div>
      <Table
        dataSource={status}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

// 유틸리티 함수
const getPlatformColor = (platform: string): string => {
  const colors: { [key: string]: string } = {
    instagram: 'magenta',
    facebook: 'blue',
    linkedin: 'cyan',
    tiktok: 'red',
    whatsapp: 'green',
  };
  return colors[platform] || 'default';
};

export default AdminManagement;

