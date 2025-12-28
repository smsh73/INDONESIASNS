import React from 'react';
import { Card } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

interface ClickableChartProps {
  title: string;
  children: React.ReactNode;
  onMoreClick?: () => void;
  extra?: React.ReactNode;
}

const ClickableChart: React.FC<ClickableChartProps> = ({ 
  title, 
  children, 
  onMoreClick,
  extra 
}) => {
  return (
    <Card
      title={title}
      extra={
        extra || (onMoreClick ? (
          <span 
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={onMoreClick}
          >
            더보기 <ArrowRightOutlined />
          </span>
        ) : null)
      }
    >
      {children}
    </Card>
  );
};

export default ClickableChart;

