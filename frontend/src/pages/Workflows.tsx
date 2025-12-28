import React, { useEffect, useState } from 'react';
import { 
  Table, Card, Button, Modal, Form, Input, Select, 
  message, Tag, Space, Popconfirm, Switch, Tabs 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Workflows.css';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface Workflow {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  trigger_conditions: any;
  actions: any;
  is_active: boolean;
  created_at: string;
}

const Workflows: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await api.get('/workflows');
      setWorkflows(response.data.data);
    } catch (error: any) {
      message.error('워크플로우 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async (workflowId: number) => {
    try {
      const response = await api.get(`/workflows/${workflowId}/executions`);
      setExecutions(response.data.data);
    } catch (error: any) {
      message.error('실행 로그를 불러오는데 실패했습니다');
    }
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    form.setFieldsValue({
      name: workflow.name,
      description: workflow.description,
      triggerType: workflow.trigger_type,
      triggerConditions: JSON.stringify(workflow.trigger_conditions, null, 2),
      actions: JSON.stringify(workflow.actions, null, 2),
      isActive: workflow.is_active,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/workflows/${id}`);
      message.success('워크플로우가 삭제되었습니다');
      fetchWorkflows();
    } catch (error: any) {
      message.error('워크플로우 삭제에 실패했습니다');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      let triggerConditions, actions;
      
      try {
        triggerConditions = typeof values.triggerConditions === 'string' 
          ? JSON.parse(values.triggerConditions) 
          : values.triggerConditions;
      } catch (e) {
        message.error('트리거 조건 JSON 형식이 올바르지 않습니다');
        return;
      }

      try {
        actions = typeof values.actions === 'string' 
          ? JSON.parse(values.actions) 
          : values.actions;
      } catch (e) {
        message.error('액션 JSON 형식이 올바르지 않습니다');
        return;
      }

      const workflowData = {
        ...values,
        triggerConditions,
        actions,
      };

      if (editingWorkflow) {
        await api.put(`/workflows/${editingWorkflow.id}`, workflowData);
        message.success('워크플로우가 수정되었습니다');
      } else {
        await api.post('/workflows', workflowData);
        message.success('워크플로우가 생성되었습니다');
      }
      setIsModalVisible(false);
      fetchWorkflows();
    } catch (error: any) {
      message.error(error.response?.data?.message || (editingWorkflow ? '워크플로우 수정에 실패했습니다' : '워크플로우 생성에 실패했습니다'));
    }
  };

  const handleExecute = async (id: number) => {
    try {
      await api.post(`/workflows/${id}/execute`, {
        triggerData: {
          postId: null,
          riskId: null,
        },
      });
      message.success('워크플로우가 실행되었습니다');
    } catch (error: any) {
      message.error('워크플로우 실행에 실패했습니다');
    }
  };

  const workflowColumns = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '트리거 타입',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      render: (type: string) => <Tag>{type}</Tag>,
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
      render: (_: any, record: Workflow) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record.id)}
          >
            실행
          </Button>
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

  const executionColumns = [
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
    <div className="workflows">
      <Card
        title="워크플로우 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            워크플로우 추가
          </Button>
        }
      >
        <Tabs defaultActiveKey="workflows">
          <TabPane tab="워크플로우" key="workflows">
            <Table
              columns={workflowColumns}
              dataSource={workflows}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              onRow={(record) => ({
                onDoubleClick: () => {
                  setSelectedWorkflowId(record.id);
                  fetchExecutions(record.id);
                },
              })}
            />
          </TabPane>
          {selectedWorkflowId && (
            <TabPane tab="실행 로그" key="executions">
              <Table
                columns={executionColumns}
                dataSource={executions}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </TabPane>
          )}
        </Tabs>
      </Card>

      <Modal
        title={editingWorkflow ? '워크플로우 수정' : '워크플로우 추가'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText={editingWorkflow ? '수정' : '생성'}
        cancelText="취소"
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="워크플로우 이름" />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <TextArea rows={2} placeholder="설명" />
          </Form.Item>

          <Form.Item
            name="triggerType"
            label="트리거 타입"
            rules={[{ required: true, message: '트리거 타입을 선택해주세요' }]}
          >
            <Select placeholder="트리거 타입 선택">
              <Option value="risk_level">위험 수준</Option>
              <Option value="sentiment">감정</Option>
              <Option value="keyword">키워드</Option>
              <Option value="region">지역</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="triggerConditions"
            label="트리거 조건 (JSON)"
            rules={[{ required: true, message: '트리거 조건을 입력해주세요' }]}
          >
            <TextArea rows={4} placeholder='{"type": "risk_level", "values": ["high", "critical"]}' />
          </Form.Item>

          <Form.Item
            name="actions"
            label="액션 (JSON)"
            rules={[{ required: true, message: '액션을 입력해주세요' }]}
          >
            <TextArea rows={4} placeholder='[{"type": "create_alert", "title": "Alert", "message": "Message"}]' />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="활성화"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Workflows;

