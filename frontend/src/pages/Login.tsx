import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import LanguageSelector from '../components/LanguageSelector/LanguageSelector';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { t } = useTranslation();

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success(t('login.loginSuccess'));
      navigate('/');
    } catch (error: any) {
      message.error(error.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-shape login-shape-1"></div>
        <div className="login-background-shape login-shape-2"></div>
        <div className="login-background-shape login-shape-3"></div>
      </div>
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
        <LanguageSelector />
      </div>
      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="login-title">{t('login.title')}</h1>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          className="login-form"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('login.email') },
              { type: 'email', message: t('login.email') },
            ]}
          >
            <Input
              prefix={<UserOutlined className="login-input-icon" />}
              placeholder={t('login.email')}
              size="large"
              className="login-input"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: t('login.password') }]}
          >
            <Input.Password
              prefix={<LockOutlined className="login-input-icon" />}
              placeholder={t('login.password')}
              size="large"
              className="login-input"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              className="login-button"
            >
              {t('login.loginButton')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;

