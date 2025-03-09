import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './index.css';

// 导入页面组件
import Layout from './components/Layout';
import DocumentManagement from './pages/DocumentManagement';
import ChatInterface from './pages/ChatInterface';
import KnowledgeQA from './pages/KnowledgeQA';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DocumentManagement />} />
            <Route path="chat" element={<ChatInterface />} />
            <Route path="knowledge-qa" element={<KnowledgeQA />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  </React.StrictMode>
);