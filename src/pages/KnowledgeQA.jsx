import React, { useState, useEffect } from 'react';
import { Input, Button, Select, Card, List, Space, message, Switch, Tooltip, Spin, Tag } from 'antd';
import { SendOutlined, DatabaseOutlined, ClearOutlined, PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { getAvailableModels, chat, getEmbedding } from '../services/ollamaService';
import { getRecentDocuments, searchSimilarDocuments } from '../services/milvusService';

const { TextArea } = Input;
const { Option } = Select;

const KnowledgeQA = () => {
  // 聊天状态
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 模型相关状态
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  
  // 对话历史相关状态
  const [chatHistory, setChatHistory] = useState([]);
  const [isFromHistory, setIsFromHistory] = useState(false);
  
  // 知识库相关状态
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  // 初始化加载模型和文档
  useEffect(() => {
    fetchModels();
    fetchDocuments();
  }, []);

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

  // 获取知识库文档列表
  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await getRecentDocuments();
      setDocuments(docs);
    } catch (error) {
      message.error('获取知识库文档失败');
      console.error('获取知识库文档失败:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // 处理发送消息
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
    // 发送消息后，当前对话不再视为来自历史记录
    setIsFromHistory(false);

    try {
      let response;
      let searchResults = [];
      
      // 如果启用了知识库且选择了文档，使用RAG模式
      if (useKnowledgeBase && selectedDocuments.length >= 0) {
        console.log('【RAG查询】开始处理，使用知识库模式');
        console.log(`【RAG查询】选中的文档IDs: ${selectedDocuments.join(', ')}`);
        console.log(`【RAG查询】用户问题: ${inputText}`);
        
        // 1. 获取用户问题的嵌入向量
        console.log('【RAG查询】步骤1: 获取用户问题的嵌入向量...');
        const queryEmbedding = await getEmbedding(inputText);
        console.log(`【RAG查询】嵌入向量生成完成，维度: ${queryEmbedding.length}`);
        
        // 2. 从知识库中检索相关文档
        console.log('【RAG查询】步骤2: 从知识库中检索相关文档...');
        console.log(`【RAG查询】查询参数: topK=3, 选中文档IDs=${JSON.stringify(selectedDocuments)}`);
        console.log(`【RAG查询】查询向量维度: ${queryEmbedding.length}`);
        console.log(`【RAG查询】查询向量示例(前5个值): [${queryEmbedding.slice(0, 5).join(', ')}...]`);
        
        try {
          searchResults = await searchSimilarDocuments(queryEmbedding, 3, selectedDocuments);
          console.log(`【RAG查询】检索到 ${searchResults.length} 个相关文档片段:`);
          searchResults.forEach((result, index) => {
            console.log(`【RAG查询】文档片段 ${index + 1}:`);
            console.log(`  - 文件ID: ${result.fileId}`);
            console.log(`  - 相似度得分: ${result.score}`);
            console.log(`  - 内容片段: ${result.content.substring(0, 100)}...`);
          });
        } catch (searchError) {
          console.error('【RAG查询错误】搜索文档失败:', searchError);
          message.error(`搜索文档失败: ${searchError.message}`);
          // 如果搜索失败，仍然继续执行，但不使用知识库
          console.log('【RAG查询】搜索失败，将使用普通对话模式');
          const response = await chat(inputText, selectedModel, []);
          const assistantMessage = {
            type: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setLoading(false);
          return;
        }
        
        // 3. 构建包含上下文的提示
        console.log('【RAG查询】步骤3: 构建包含上下文的提示...');
        const context = searchResults.map(result => result.content).join('\n\n');
        const ragPrompt = `基于以下上下文回答问题：\n\n${context}\n\n问题：${inputText}`;
        console.log(`【RAG查询】构建的提示总长度: ${ragPrompt.length} 字符`);
        
        // 4. 发送带有上下文的提示给模型
        console.log(`【RAG查询】步骤4: 发送提示到模型 ${selectedModel}...`);
        response = await chat(ragPrompt, selectedModel, []);
        console.log('【RAG查询】模型响应完成');
        
        // 添加一个系统消息，显示使用了哪些文档
        const usedDocuments = searchResults.map(result => {
          const docInfo = documents.find(doc => doc.uid === result.fileId) || { name: result.fileId };
          return docInfo.name;
        });
        console.log(`【RAG查询】使用的文档: ${usedDocuments.join(', ')}`);
        
        const systemMessage = {
          type: 'system',
          content: `已参考知识库文档: ${usedDocuments.join(', ')}`,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, systemMessage]);
      } else {
        // 普通对话模式
        const history = messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : msg.type === 'assistant' ? 'assistant' : 'system',
          content: msg.content
        }));
        
        response = await chat(inputText, selectedModel, history);
      }

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

  // 清空对话
  const handleClearChat = () => {
    setMessages([]);
  };

  // 处理文档选择变化
  const handleDocumentChange = (selectedIds) => {
    setSelectedDocuments(selectedIds);
  };
  
  // 新建对话
  const handleNewChat = () => {
    if (messages.length > 0 && !isFromHistory) {
      setChatHistory([...chatHistory, messages]);
    }
    setMessages([]);
    setIsFromHistory(false);
  };
  
  // 从历史记录中选择对话
  const handleHistorySelect = (index) => {
    // 保存当前对话到历史记录，只有当当前对话不为空且不是从历史记录中选择的才添加
    if (messages.length > 0 && !isFromHistory) {
      setChatHistory([...chatHistory, messages]);
    }
    
    // 获取选中的历史对话
    const selectedChat = chatHistory[index];
    
    // 设置当前对话为选中的历史对话
    setMessages(selectedChat);
    // 标记当前对话来自历史记录
    setIsFromHistory(true);
    
    // 不再从历史记录中移除选中的对话，保留所有历史对话
    // 这样用户可以随时查看任何历史对话，不会因为查看过一次就丢失
  };

  return (
    <div className="knowledge-qa-container">
      <Card
        title="知识问答"
        extra={
          <Space>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 180 }}
              options={models.map(model => ({ label: model.name, value: model.name }))}
              placeholder="选择模型"
            />
            <Switch
              checked={useKnowledgeBase}
              onChange={setUseKnowledgeBase}
              checkedChildren="启用知识库"
              unCheckedChildren="纯对话模式"
            />
            <Tooltip title="清空当前对话">
              <Button
                icon={<ClearOutlined />}
                onClick={handleClearChat}
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
        <div style={{ display: 'flex', height: 'calc(100vh - 220px)' }}>
          {/* 知识库选择侧边栏 */}
          {useKnowledgeBase && (
            <div style={{ width: 250, marginRight: 16, overflowY: 'auto', borderRight: '1px solid #f0f0f0', padding: '0 16px 16px 0' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>
                  <DatabaseOutlined /> 知识库文档
                </h3>
                <Button size="small" onClick={fetchDocuments} loading={loadingDocuments}>
                  刷新
                </Button>
              </div>
              
              {loadingDocuments ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin tip="加载文档中..." />
                </div>
              ) : documents.length > 0 ? (
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择参考文档"
                  value={selectedDocuments}
                  onChange={handleDocumentChange}
                  optionLabelProp="label"
                  optionFilterProp="label"
                >
                  {documents.map(doc => (
                    <Option key={doc.uid || `doc-${doc.name}-${Math.random()}`} value={doc.uid} label={doc.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{doc.name}</span>
                        <Tag color="blue">{doc.type}</Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>
                  暂无文档，请先上传文档
                </div>
              )}
            </div>
          )}
          
          {/* 聊天主界面 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <List
              className="message-list"
              style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}
              itemLayout="horizontal"
              dataSource={messages}
              renderItem={item => (
                <List.Item className={`message-item message-${item.type}`}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {item.type === 'user' ? '你' : item.type === 'system' ? '系统' : 'AI助手'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
                  </Space>
                </List.Item>
              )}
            />

            <div style={{ marginTop: 16 }}>
              <TextArea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={useKnowledgeBase ? "输入问题，AI将基于选定的知识库文档回答..." : "输入你的问题..."}
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ marginBottom: 16 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
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
          </div>
        </div>
      </Card>
    </div>
  );
};

export default KnowledgeQA;