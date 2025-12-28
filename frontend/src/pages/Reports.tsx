import React, { useEffect, useState } from 'react';
import { Card, Button, DatePicker, Select, Row, Col, Statistic, Table, message, Spin, Space } from 'antd';
import { DownloadOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import './Reports.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      let endpoint = '';
      let params: any = {};

      if (reportType === 'daily') {
        endpoint = '/reports/daily';
        if (selectedDate) {
          params.date = selectedDate;
        }
      } else {
        endpoint = '/reports/weekly';
        if (selectedDate) {
          params.weekStart = selectedDate;
        }
      }

      const response = await api.get(endpoint, { params });
      setReportData(response.data?.data || null);
    } catch (error: any) {
      message.error('보고서를 불러오는데 실패했습니다');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      if (format === 'excel') {
        const params: any = {
          type: reportType,
          format: 'excel',
        };
        if (selectedDate) {
          params[reportType === 'daily' ? 'date' : 'weekStart'] = selectedDate;
        }
        
        const response = await api.get('/export/report', {
          params,
          responseType: 'blob',
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const filename = `${reportType}_report_${selectedDate || new Date().toISOString().split('T')[0]}.xlsx`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        message.success('Excel 파일 다운로드가 시작되었습니다');
      } else {
        message.info('PDF 형식은 준비 중입니다');
      }
    } catch (error: any) {
      message.error('내보내기에 실패했습니다');
    }
  };

  if (loading && !reportData) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const sentimentChartData = reportData?.sentiment
    ? Object.entries(reportData.sentiment).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const riskChartData = reportData?.risk
    ? Object.entries(reportData.risk).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <div className="reports">
      <Card
        title="보고서"
        extra={
          <Space>
            <Select
              value={reportType}
              onChange={setReportType}
              style={{ width: 120 }}
            >
              <Option value="daily">일일 보고서</Option>
              <Option value="weekly">주간 보고서</Option>
            </Select>
            <DatePicker
              format="YYYY-MM-DD"
              onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : null)}
              placeholder={reportType === 'daily' ? '날짜 선택' : '주 시작일 선택'}
            />
            <Button icon={<DownloadOutlined />} onClick={fetchReport}>
              새로고침
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={() => handleExport('pdf')}>
              PDF
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => handleExport('excel')}>
              Excel
            </Button>
          </Space>
        }
      >
        {reportData && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="총 포스팅"
                    value={reportData.summary?.totalPosts || 0}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="총 멘션"
                    value={reportData.summary?.totalMentions || 0}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="긍정 반응"
                    value={reportData.sentiment?.positive || 0}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="부정 반응"
                    value={reportData.sentiment?.negative || 0}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="감정 분포">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sentimentChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => {
                          const numPercent = typeof percent === 'number' ? percent : parseFloat(percent) || 0;
                          return `${name} ${(numPercent * 100).toFixed(0)}%`;
                        }}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sentimentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#52c41a', '#ff4d4f', '#8c8c8c', '#fa8c16'][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card title="위험 분포">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={riskChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {reportData.trends && (
                <>
                  <Col xs={24} lg={12}>
                    <Card title="포스팅 트렌드">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={reportData.trends.posts}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="count" stroke="#8884d8" name="포스팅 수" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card title="감정 트렌드">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={reportData.trends.sentiment}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="count" stroke="#52c41a" name="긍정" />
                          <Line type="monotone" dataKey="count" stroke="#ff4d4f" name="부정" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                </>
              )}

              {reportData.topRegions && reportData.topRegions.length > 0 && (
                <Col xs={24} lg={12}>
                  <Card title="상위 지역">
                    <Table
                      dataSource={reportData.topRegions}
                      columns={[
                        { title: '지역', dataIndex: 'province', key: 'province' },
                        { title: '포스팅 수', dataIndex: 'post_count', key: 'post_count' },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  </Card>
                </Col>
              )}

              {reportData.topPlatforms && reportData.topPlatforms.length > 0 && (
                <Col xs={24} lg={12}>
                  <Card title="플랫폼 분포">
                    <Table
                      dataSource={reportData.topPlatforms}
                      columns={[
                        { title: '플랫폼', dataIndex: 'platform', key: 'platform' },
                        { title: '수량', dataIndex: 'count', key: 'count' },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  </Card>
                </Col>
              )}

              {reportData.topKeywords && reportData.topKeywords.length > 0 && (
                <Col xs={24}>
                  <Card title="상위 키워드">
                    <Table
                      dataSource={reportData.topKeywords}
                      columns={[
                        { title: '키워드', dataIndex: 'keyword', key: 'keyword' },
                        { title: '멘션 수', dataIndex: 'count', key: 'count' },
                      ]}
                      pagination={false}
                    />
                  </Card>
                </Col>
              )}
            </Row>
          </>
        )}
      </Card>
    </div>
  );
};

export default Reports;

