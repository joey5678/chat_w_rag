import React, { useState, useEffect } from 'react';
import { Layout, Menu, Tag } from 'antd';
import { FileTextOutlined, MessageOutlined, BookOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { checkOllamaService } from '../services/ollamaService';
import { createDocumentCollection } from '../services/milvusService';

const { Header, Content } = Layout;

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [milvusAvailable, setMilvusAvailable] = useState(false);

  // 初始化检查服务可用性
  useEffect(() => {
    let mounted = true;
    const checkServices = async () => {
      if (!mounted) return;
      try {
        // 检查Ollama服务
        const ollamaStatus = await checkOllamaService();
        if (mounted) setOllamaAvailable(ollamaStatus);
        
        // 初始化Milvus集合
        try {
          await createDocumentCollection();
          if (mounted) setMilvusAvailable(true);
        } catch (error) {
          console.error('Milvus初始化失败:', error);
          if (mounted) setMilvusAvailable(false);
        }
      } catch (error) {
        console.error('服务检查失败:', error);
      }
    };
    
    checkServices();
    return () => {
      mounted = false;
    };
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: '文档管理'
    },

    {
      key: '/knowledge-qa',
      icon: <BookOutlined />,
      label: '知识问答'
    }
  ];

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <div style={{ color: '#1890ff', fontSize: '18px', fontWeight: 'bold', marginRight: '24px', display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '16px' }}>个人知识库</span>
          <Tag color={ollamaAvailable ? 'success' : 'error'} style={{ marginRight: '8px' }}>
            Ollama: {ollamaAvailable ? '可用' : '不可用'}
          </Tag>
          <Tag color={milvusAvailable ? 'success' : 'error'}>
            Milvus: {milvusAvailable ? '可用' : '不可用'}
          </Tag>
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