import React, { useState } from 'react';
import { Input, Button, Select, Card, List, Space, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('all');
  const [loading, setLoading] = useState(false);

  const databases = [
    { label: '全部数据', value: 'all' },
    { label: '技术文档', value: 'technical' },
    { label: '代码文件', value: 'code' },
    { label: '笔记', value: 'notes' }
  ];

  const handleSend = async () => {
    if (!inputText.trim()) {
      return;
    }

    const userMessage = {
      type: 'user',
      content: inputText,
      timestamp: new Date().toISOString()
    };

    setMessages([...messages, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // TODO: 实现与Ollama API的集成
      // 1. 准备上下文（从Milvus检索相关文档）
      // 2. 调用Ollama API进行对话
      // 3. 处理响应

      const assistantMessage = {
        type: 'assistant',
        content: '这是一个模拟的回复。实际实现时，这里将是来自Ollama的响应。',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      message.error('发送消息失败');
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <Card
        title="知识问答"
        extra={
          <Select
            value={selectedDatabase}
            onChange={setSelectedDatabase}
            style={{ width: 200 }}
            options={databases}
            placeholder="选择知识库范围"
          />
        }
      >
        <List
          className="message-list"
          itemLayout="horizontal"
          dataSource={messages}
          renderItem={item => (
            <List.Item className={`message-item message-${item.type}`}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {item.type === 'user' ? '你' : 'AI助手'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
              </Space>
            </List.Item>
          )}
        />

        <div style={{ marginTop: 24 }}>
          <TextArea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="输入你的问题..."
            autoSize={{ minRows: 3, maxRows: 6 }}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleSend}
            block
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;