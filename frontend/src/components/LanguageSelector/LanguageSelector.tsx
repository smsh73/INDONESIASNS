import React from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select
      value={i18n.language || 'ko'}
      onChange={handleLanguageChange}
      style={{ width: 150 }}
      suffixIcon={<GlobalOutlined />}
    >
      <Select.Option value="ko">한국어</Select.Option>
      <Select.Option value="en">English</Select.Option>
      <Select.Option value="id">Bahasa Indonesia</Select.Option>
    </Select>
  );
};

export default LanguageSelector;

