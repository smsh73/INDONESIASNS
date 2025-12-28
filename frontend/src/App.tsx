import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardDetail from './pages/DashboardDetail';
import Analysis from './pages/Analysis';
import Regions from './pages/Regions';
import Alerts from './pages/Alerts';
import PostDetail from './pages/PostDetail';
import Accounts from './pages/Accounts';
import Trends from './pages/Trends';
import Reports from './pages/Reports';
import Workflows from './pages/Workflows';
import CollectionJobs from './pages/CollectionJobs';
import Admin from './pages/Admin';
import AdminManagement from './pages/AdminManagement';
import MapDashboard from './pages/MapDashboard';
import MonitoringStatistics from './pages/MonitoringStatistics';
import { useAuthStore } from './store/authStore';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { i18n } = useTranslation();

  const getAntdLocale = () => {
    switch (i18n.language) {
      case 'en':
        return enUS;
      case 'id':
        return enUS; // Ant Design doesn't have Indonesian locale, use English
      case 'ko':
      default:
        return koKR;
    }
  };

  return (
    <ConfigProvider locale={getAntdLocale()}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Layout>
                  <Dashboard />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/dashboard/:type/:value"
            element={
              isAuthenticated ? (
                <Layout>
                  <DashboardDetail />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/analysis"
            element={
              isAuthenticated ? (
                <Layout>
                  <Analysis />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/regions"
            element={
              isAuthenticated ? (
                <Layout>
                  <Regions />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/alerts"
            element={
              isAuthenticated ? (
                <Layout>
                  <Alerts />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/posts/:id"
            element={
              isAuthenticated ? (
                <Layout>
                  <PostDetail />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/accounts"
            element={
              isAuthenticated ? (
                <Layout>
                  <Accounts />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/trends"
            element={
              isAuthenticated ? (
                <Layout>
                  <Trends />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/reports"
            element={
              isAuthenticated ? (
                <Layout>
                  <Reports />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/workflows"
            element={
              isAuthenticated ? (
                <Layout>
                  <Workflows />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/collection"
            element={
              isAuthenticated ? (
                <Layout>
                  <CollectionJobs />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
                 <Route
                   path="/admin"
                   element={
                     isAuthenticated ? (
                       <Layout>
                         <Admin />
                       </Layout>
                     ) : (
                       <Navigate to="/login" replace />
                     )
                   }
                 />
                 <Route
                   path="/admin/management"
                   element={
                     isAuthenticated ? (
                       <Layout>
                         <AdminManagement />
                       </Layout>
                     ) : (
                       <Navigate to="/login" replace />
                     )
                   }
                 />
          <Route
            path="/monitoring/statistics"
            element={
              isAuthenticated ? (
                <Layout>
                  <MonitoringStatistics />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/map"
            element={
              isAuthenticated ? (
                <Layout>
                  <MapDashboard />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

function App() {
  return <AppContent />;
}

export default App;

