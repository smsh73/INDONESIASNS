import React, { useEffect, useState } from 'react';
import { Tabs, Card, Table, Button, Modal, Form, Input, Select, message, Tag, Space, Popconfirm, Switch, InputNumber, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Admin.css';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [form] = Form.useForm();

  return (
    <div className="admin">
      <Card title={<><SettingOutlined /> 관리자 설정</>}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="API Keys" key="api-keys">
            <ApiKeysTab />
          </TabPane>
          <TabPane tab="SNS 계정" key="accounts">
            <AccountsTab />
          </TabPane>
          <TabPane tab="모니터링 키워드" key="keywords">
            <KeywordsTab />
          </TabPane>
          <TabPane tab="모니터링 해시태그" key="hashtags">
            <HashtagsTab />
          </TabPane>
          <TabPane tab="국가" key="countries">
            <CountriesTab />
          </TabPane>
          <TabPane tab="지역" key="regions">
            <RegionsTab />
          </TabPane>
          <TabPane tab="지도 데이터" key="map-data">
            <MapDataTab />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

// API Keys Tab
const ApiKeysTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
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

  const handleEdit = (key: any) => {
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
        message.success('API 키가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchApiKeys();
    } catch (error: any) {
      message.error(editingKey ? 'API 키 수정에 실패했습니다' : 'API 키 생성에 실패했습니다');
    }
  };

  const columns = [
    { title: '이름', dataIndex: 'name', key: 'name' },
    {
      title: '서비스',
      dataIndex: 'service',
      key: 'service',
      render: (service: string) => <Tag>{service}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
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
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        API 키 추가
      </Button>
      <Table columns={columns} dataSource={apiKeys} loading={loading} rowKey="id" />
      <Modal
        title={editingKey ? 'API 키 수정' : 'API 키 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="이름" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="service" label="서비스" rules={[{ required: true }]}>
            <Select>
              <Option value="openai">OpenAI</Option>
              <Option value="google">Google</Option>
              <Option value="azure">Azure</Option>
              <Option value="aws">AWS</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>
          {!editingKey && (
            <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          {editingKey && (
            <Form.Item name="apiKey" label="새 API Key (변경 시에만 입력)">
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="isActive" label="활성화" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// Accounts Tab (기존 Accounts 페이지 재사용)
const AccountsTab: React.FC = () => {
  return <div>계정 관리 기능은 별도 페이지에서 제공됩니다.</div>;
};

// Keywords Tab
const KeywordsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<any>(null);
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

  const handleEdit = (keyword: any) => {
    setEditingKeyword(keyword);
    form.setFieldsValue({
      keyword: keyword.keyword,
      platform: keyword.platform,
      priority: keyword.priority,
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
        message.success('키워드가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchKeywords();
    } catch (error: any) {
      message.error(editingKeyword ? '키워드 수정에 실패했습니다' : '키워드 생성에 실패했습니다');
    }
  };

  const columns = [
    { title: '키워드', dataIndex: 'keyword', key: 'keyword' },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => platform ? <Tag>{platform}</Tag> : '-',
    },
    { title: '우선순위', dataIndex: 'priority', key: 'priority' },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        키워드 추가
      </Button>
      <Table columns={columns} dataSource={keywords} loading={loading} rowKey="id" />
      <Modal
        title={editingKeyword ? '키워드 수정' : '키워드 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="keyword" label="키워드" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="platform" label="플랫폼">
            <Select allowClear>
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="우선순위">
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// Hashtags Tab (Keywords와 유사)
const HashtagsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingHashtag, setEditingHashtag] = useState<any>(null);
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

  const handleEdit = (hashtag: any) => {
    setEditingHashtag(hashtag);
    form.setFieldsValue({
      hashtag: hashtag.hashtag,
      platform: hashtag.platform,
      priority: hashtag.priority,
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
        message.success('해시태그가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchHashtags();
    } catch (error: any) {
      message.error(editingHashtag ? '해시태그 수정에 실패했습니다' : '해시태그 생성에 실패했습니다');
    }
  };

  const columns = [
    { title: '해시태그', dataIndex: 'hashtag', key: 'hashtag' },
    {
      title: '플랫폼',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => platform ? <Tag>{platform}</Tag> : '-',
    },
    { title: '우선순위', dataIndex: 'priority', key: 'priority' },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        해시태그 추가
      </Button>
      <Table columns={columns} dataSource={hashtags} loading={loading} rowKey="id" />
      <Modal
        title={editingHashtag ? '해시태그 수정' : '해시태그 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="hashtag" label="해시태그" rules={[{ required: true }]}>
            <Input placeholder="#hashtag" />
          </Form.Item>
          <Form.Item name="platform" label="플랫폼">
            <Select allowClear>
              <Option value="instagram">Instagram</Option>
              <Option value="facebook">Facebook</Option>
              <Option value="linkedin">LinkedIn</Option>
              <Option value="tiktok">TikTok</Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="우선순위">
            <InputNumber min={0} max={100} />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// Countries Tab
const CountriesTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCountry, setEditingCountry] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/countries');
      setCountries(response.data.data);
    } catch (error: any) {
      message.error('국가 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCountry(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (country: any) => {
    setEditingCountry(country);
    form.setFieldsValue({
      name: country.name,
      code: country.code,
      isoCode: country.iso_code,
      latitude: country.latitude,
      longitude: country.longitude,
      mapImageUrl: country.map_image_url,
      isActive: country.is_active,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/countries/${id}`);
      message.success('국가가 삭제되었습니다');
      fetchCountries();
    } catch (error: any) {
      message.error('국가 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingCountry) {
        await api.put(`/admin/countries/${editingCountry.id}`, values);
        message.success('국가가 수정되었습니다');
      } else {
        await api.post('/admin/countries', values);
        message.success('국가가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchCountries();
    } catch (error: any) {
      message.error(editingCountry ? '국가 수정에 실패했습니다' : '국가 생성에 실패했습니다');
    }
  };

  const columns = [
    { title: '국가명', dataIndex: 'name', key: 'name' },
    { title: '코드', dataIndex: 'code', key: 'code' },
    { title: 'ISO 코드', dataIndex: 'iso_code', key: 'iso_code' },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        국가 추가
      </Button>
      <Table columns={columns} dataSource={countries} loading={loading} rowKey="id" />
      <Modal
        title={editingCountry ? '국가 수정' : '국가 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="국가명" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="코드">
            <Input />
          </Form.Item>
          <Form.Item name="isoCode" label="ISO 코드">
            <Input />
          </Form.Item>
          <Form.Item name="latitude" label="위도">
            <InputNumber step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="longitude" label="경도">
            <InputNumber step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="mapImageUrl" label="지도 이미지 URL">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="활성화" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// Regions Tab
const RegionsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRegion, setEditingRegion] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRegions();
    fetchCountries();
  }, []);

  const fetchRegions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/regions');
      setRegions(response.data.data);
    } catch (error: any) {
      message.error('지역 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await api.get('/admin/countries');
      setCountries(response.data.data);
    } catch (error: any) {
      // Ignore error
    }
  };

  const handleCreate = () => {
    setEditingRegion(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (region: any) => {
    setEditingRegion(region);
    form.setFieldsValue({
      province: region.province,
      city: region.city,
      district: region.district,
      latitude: region.latitude,
      longitude: region.longitude,
      countryId: region.country_id,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/regions/${id}`);
      message.success('지역이 삭제되었습니다');
      fetchRegions();
    } catch (error: any) {
      message.error('지역 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRegion) {
        await api.put(`/admin/regions/${editingRegion.id}`, values);
        message.success('지역이 수정되었습니다');
      } else {
        await api.post('/admin/regions', values);
        message.success('지역이 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchRegions();
    } catch (error: any) {
      message.error(editingRegion ? '지역 수정에 실패했습니다' : '지역 생성에 실패했습니다');
    }
  };

  const columns = [
    { title: '도/주', dataIndex: 'province', key: 'province' },
    { title: '시/군', dataIndex: 'city', key: 'city' },
    { title: '구/읍', dataIndex: 'district', key: 'district' },
    { title: '위도', dataIndex: 'latitude', key: 'latitude' },
    { title: '경도', dataIndex: 'longitude', key: 'longitude' },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        지역 추가
      </Button>
      <Table columns={columns} dataSource={regions} loading={loading} rowKey="id" />
      <Modal
        title={editingRegion ? '지역 수정' : '지역 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="province" label="도/주" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="city" label="시/군">
            <Input />
          </Form.Item>
          <Form.Item name="district" label="구/읍">
            <Input />
          </Form.Item>
          <Form.Item name="countryId" label="국가">
            <Select allowClear>
              {countries.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="latitude" label="위도">
            <InputNumber step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="longitude" label="경도">
            <InputNumber step={0.0001} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// Map Data Tab
const MapDataTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingMapData, setEditingMapData] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMapData();
    fetchCountries();
    fetchRegions();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/map-data');
      setMapData(response.data.data);
    } catch (error: any) {
      message.error('지도 데이터 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await api.get('/admin/countries');
      setCountries(response.data.data);
    } catch (error: any) {
      // Ignore error
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions');
      setRegions(response.data.data);
    } catch (error: any) {
      // Ignore error
    }
  };

  const handleCreate = () => {
    setEditingMapData(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (data: any) => {
    setEditingMapData(data);
    form.setFieldsValue({
      countryId: data.country_id,
      regionId: data.region_id,
      mapType: data.map_type,
      mapImageUrl: data.map_image_url,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/map-data/${id}`);
      message.success('지도 데이터가 삭제되었습니다');
      fetchMapData();
    } catch (error: any) {
      message.error('지도 데이터 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingMapData) {
        await api.put(`/admin/map-data/${editingMapData.id}`, values);
        message.success('지도 데이터가 수정되었습니다');
      } else {
        await api.post('/admin/map-data', values);
        message.success('지도 데이터가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchMapData();
    } catch (error: any) {
      message.error(editingMapData ? '지도 데이터 수정에 실패했습니다' : '지도 데이터 생성에 실패했습니다');
    }
  };

  const columns = [
    {
      title: '지도 타입',
      dataIndex: 'map_type',
      key: 'map_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '국가',
      dataIndex: 'country_id',
      key: 'country_id',
      render: (id: number) => {
        const country = countries.find((c) => c.id === id);
        return country ? country.name : '-';
      },
    },
    {
      title: '지역',
      dataIndex: 'region_id',
      key: 'region_id',
      render: (id: number) => {
        const region = regions.find((r) => r.id === id);
        return region ? `${region.province} ${region.city || ''}` : '-';
      },
    },
    {
      title: '작업',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            수정
          </Button>
          <Popconfirm title="정말 삭제하시겠습니까?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ marginBottom: 16 }}>
        지도 데이터 추가
      </Button>
      <Table columns={columns} dataSource={mapData} loading={loading} rowKey="id" />
      <Modal
        title={editingMapData ? '지도 데이터 수정' : '지도 데이터 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="mapType" label="지도 타입" rules={[{ required: true }]}>
            <Select>
              <Option value="country">국가</Option>
              <Option value="province">도/주</Option>
              <Option value="city">시/군</Option>
              <Option value="district">구/읍</Option>
            </Select>
          </Form.Item>
          <Form.Item name="countryId" label="국가">
            <Select allowClear>
              {countries.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="regionId" label="지역">
            <Select allowClear>
              {regions.map((r) => (
                <Option key={r.id} value={r.id}>
                  {r.province} {r.city || ''} {r.district || ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="mapImageUrl" label="지도 이미지 URL">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Admin;

