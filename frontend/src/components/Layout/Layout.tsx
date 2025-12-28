import React, { useEffect } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DashboardOutlined,
  BarChartOutlined,
  GlobalOutlined,
  BellOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  LineChartOutlined,
  FileTextOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import LanguageSelector from '../LanguageSelector/LanguageSelector';
import './Layout.css';

const { Header, Content, Sider } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, checkAuth } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('common.dashboard'),
    },
    {
      key: '/analysis',
      icon: <BarChartOutlined />,
      label: t('common.analysis'),
    },
    {
      key: '/regions',
      icon: <GlobalOutlined />,
      label: t('common.regions'),
    },
    {
      key: '/map',
      icon: <GlobalOutlined />,
      label: t('common.map'),
    },
    {
      key: '/trends',
      icon: <LineChartOutlined />,
      label: t('common.trends'),
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: t('common.reports'),
    },
    {
      key: '/alerts',
      icon: <BellOutlined />,
      label: t('common.alerts'),
    },
    {
      key: '/accounts',
      icon: <TeamOutlined />,
      label: t('common.accounts'),
    },
    {
      key: '/workflows',
      icon: <SettingOutlined />,
      label: t('common.workflows'),
    },
    {
      key: '/collection',
      icon: <DatabaseOutlined />,
      label: t('common.collection'),
    },
    {
      key: '/monitoring/statistics',
      icon: <BarChartOutlined />,
      label: '모니터링 통계',
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: t('common.admin'),
    },
    {
      key: '/admin/management',
      icon: <SettingOutlined />,
      label: t('common.monitoring'),
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('common.profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('common.logout'),
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div className="logo">
          <h2 style={{ color: 'white', padding: '16px', textAlign: 'center' }}>
            {t('common.analysis')}
          </h2>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>{t('login.title')} {t('login.subtitle')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <LanguageSelector />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.username || 'User'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px', background: '#fff', padding: '24px', minHeight: 280 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;

