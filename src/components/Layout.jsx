import React from 'react';
import { Layout, Menu } from 'antd';
import { FileTextOutlined, MessageOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Content } = Layout;

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: '文档管理'
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: '知识问答'
    }
  ];

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <div style={{ color: '#1890ff', fontSize: '18px', fontWeight: 'bold', marginRight: '24px' }}>
          个人知识库
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, border: 'none' }}
        />
      </Header>
      <Content className="app-content">
        <Outlet />
      </Content>
    </Layout>
  );
};

export default AppLayout;