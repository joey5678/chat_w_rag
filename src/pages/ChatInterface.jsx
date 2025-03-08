import React, { useState, useEffect } from 'react';
import { Input, Button, Select, Card, List, Space, message, Switch, Tooltip } from 'antd';
import { SendOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import { getAvailableModels, chat } from '../services/ollamaService';

const { TextArea } = Input;

const databases = [
  { label: '全部知识库', value: 'all' },
  { label: '个人知识库', value: 'personal' },
  { label: '公共知识库', value: 'public' }
];

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('all');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [useHistory, setUseHistory] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);

  useEffect(() => {
    // 获取可用模型列表
    const fetchModels = async () => {
      try {
        const modelList = await getAvailableModels();
        setModels(modelList);
        if (modelList.length > 0) {
          setSelectedModel(modelList[0].name);
        }
      } catch (error) {
        message.error('获取模型列表失败');
        console.error('获取模型列表失败:', error);
      }
    };

    fetchModels();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedModel) {
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
      const history = useHistory ? messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })) : [];

      const response = await chat(inputText, selectedModel, history);

      const assistantMessage = {
        type: 'assistant',
        content: response,
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

  const handleNewChat = () => {
    if (messages.length > 0) {
      setChatHistory([...chatHistory, messages]);
    }
    setMessages([]);
  };

  const handleHistorySelect = (index) => {
    if (messages.length > 0) {
      setChatHistory([...chatHistory, messages]);
    }
    setMessages(chatHistory[index]);
    setChatHistory(chatHistory.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-container">
      <Card
        title="知识问答"
        extra={
          <Space>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 200 }}
              options={models.map(model => ({ label: model.name, value: model.name }))}
              placeholder="选择模型"
            />
            <Select
              value={selectedDatabase}
              onChange={setSelectedDatabase}
              style={{ width: 200 }}
              options={databases}
              placeholder="选择知识库范围"
            />
            <Tooltip title="使用历史记录">
              <Switch
                checked={useHistory}
                onChange={setUseHistory}
                checkedChildren="历史"
                unCheckedChildren="历史"
              />
            </Tooltip>
            <Tooltip title="新建对话">
              <Button
                icon={<PlusOutlined />}
                onClick={handleNewChat}
              />
            </Tooltip>
            <Tooltip title="查看历史对话">
              <Select
                style={{ width: 120 }}
                placeholder="历史对话"
                onChange={handleHistorySelect}
                options={chatHistory.map((_, index) => ({
                  label: `对话 ${index + 1}`,
                  value: index
                }))}
              />
            </Tooltip>
          </Space>
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