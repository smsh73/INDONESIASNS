import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, message, Breadcrumb, Tag, Descriptions, Button, Table } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import api from '../services/api';
import './PostDetail.css';

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [mentions, setMentions] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchPostDetail();
    }
  }, [id]);

  const fetchPostDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/posts/${id}`);
      setPost(response.data.data);
      setMentions(response.data.data.mentions || []);
    } catch (error: any) {
      message.error('포스팅을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>포스팅을 찾을 수 없습니다</p>
        <Button onClick={() => navigate(-1)}>뒤로</Button>
      </div>
    );
  }

  const mentionColumns = [
    {
      title: '작성자',
      dataIndex: 'author_username',
      key: 'author_username',
    },
    {
      title: '내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '좋아요',
      dataIndex: 'like_count',
      key: 'like_count',
      width: 100,
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
    <div className="post-detail">
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <a onClick={() => navigate('/')}>홈</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <a onClick={() => navigate('/analysis')}>분석</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>포스팅 상세</Breadcrumb.Item>
      </Breadcrumb>

      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)}
        style={{ marginBottom: '16px' }}
      >
        뒤로
      </Button>

      <Card title="포스팅 정보" style={{ marginBottom: '16px' }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="플랫폼">
            <Tag>{post.platform}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="계정">
            {post.username || post.author_username || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="공식 계정">
            {post.is_official ? <Tag color="green">예</Tag> : <Tag>아니오</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="지역">
            {post.province ? `${post.province}${post.city ? `, ${post.city}` : ''}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="좋아요" span={1}>
            {post.like_count || 0}
          </Descriptions.Item>
          <Descriptions.Item label="댓글" span={1}>
            {post.comment_count || 0}
          </Descriptions.Item>
          <Descriptions.Item label="공유" span={1}>
            {post.share_count || 0}
          </Descriptions.Item>
          <Descriptions.Item label="조회수" span={1}>
            {post.view_count || 0}
          </Descriptions.Item>
          <Descriptions.Item label="감정 분석" span={1}>
            {post.sentiment_category ? (
              <Tag color={
                post.sentiment_category === 'positive' ? 'green' :
                post.sentiment_category === 'negative' ? 'red' :
                post.sentiment_category === 'hot' ? 'orange' :
                post.sentiment_category === 'angry' ? 'volcano' :
                'default'
              }>
                {post.sentiment_category}
              </Tag>
            ) : '-'}
            {post.sentiment_confidence && (
              <span style={{ marginLeft: '8px', color: '#8c8c8c' }}>
                ({post.sentiment_confidence ? (parseFloat(post.sentiment_confidence) * 100).toFixed(1) : '0'}%)
              </span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="위험 분류" span={1}>
            {post.risk_category ? (
              <>
                <Tag color={
                  post.risk_level === 'critical' ? 'red' :
                  post.risk_level === 'high' ? 'orange' :
                  'default'
                }>
                  {post.risk_category} ({post.risk_level})
                </Tag>
                {post.risk_confidence && (
                  <span style={{ marginLeft: '8px', color: '#8c8c8c' }}>
                    ({post.risk_confidence ? (parseFloat(post.risk_confidence) * 100).toFixed(1) : '0'}%)
                  </span>
                )}
              </>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="생성일" span={2}>
            {new Date(post.created_at).toLocaleString('ko-KR')}
          </Descriptions.Item>
          <Descriptions.Item label="내용" span={2}>
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
              {post.content || '-'}
            </div>
          </Descriptions.Item>
          {post.url && (
            <Descriptions.Item label="원본 링크" span={2}>
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                {post.url}
              </a>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {mentions.length > 0 && (
        <Card title={`댓글/멘션 (${mentions.length}개)`}>
          <Table
            columns={mentionColumns}
            dataSource={mentions}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}
    </div>
  );
};

export default PostDetail;

