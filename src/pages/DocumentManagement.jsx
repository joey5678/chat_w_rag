import React, { useState, useEffect } from 'react';
import { Upload, Form, Input, Select, Button, Card, Table, message, Spin, Popconfirm } from 'antd';
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { processAndStoreDocument } from '../services/documentService';
import { getRecentDocuments, clearCollection, deleteDocument } from '../services/milvusService';
import { render } from 'react-dom';

const { Dragger } = Upload;
const { Option } = Select;

const DocumentManagement = () => {
  const [fileList, setFileList] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState(null);

  // 从Milvus获取最近文档并同步到localStorage
  useEffect(() => {
    const fetchRecentDocuments = async () => {
      try {
        const documents = await getRecentDocuments();
        console.log(`获取到 ${documents.length} 个最近文档:`);
        documents.forEach(doc => {
          console.log(`- ${doc.name} (${doc.type}): ${doc.status}`);
        });
        setRecentDocuments(documents);
        localStorage.setItem('recentDocuments', JSON.stringify(documents));
      } catch (error) {
        console.error('获取最近文档失败:', error);
        // 如果获取失败，尝试从localStorage加载
        const savedDocuments = localStorage.getItem('recentDocuments');
        if (savedDocuments) {
          setRecentDocuments(JSON.parse(savedDocuments));
        }
      }
    };
    fetchRecentDocuments();
  }, []);

  // 更新最近的文档列表
  const updateRecentDocuments = (newDoc) => {
    setRecentDocuments(prev => {
      // 确保新文档包含uploadTime字段
      const docWithTime = {
        ...newDoc,
        uploadTime: newDoc.uploadTime || new Date().toISOString()
      };
      const updated = [docWithTime, ...prev].slice(0, 10);
      localStorage.setItem('recentDocuments', JSON.stringify(updated));
      return updated;
    });
  };

  // 处理删除文档
  const handleDeleteDocument = async (fileId) => {
    try {
      setDeletingDocId(fileId);
      await deleteDocument(fileId);
      
      // 从文档列表中移除已删除的文档
      setRecentDocuments(prev => {
        const updated = prev.filter(doc => doc.uid !== fileId);
        localStorage.setItem('recentDocuments', JSON.stringify(updated));
        return updated;
      });
      
      message.success('文档已成功删除');
    } catch (error) {
      console.error('删除文档失败:', error);
      message.error('删除文档失败: ' + (error.message || '未知错误'));
    } finally {
      setDeletingDocId(null);
    }
  };

  const documentTypes = [
    { label: '技术文档', value: 'technical' },
    { label: '代码文件', value: 'code' },
    { label: '笔记', value: 'notes' },
    { label: '其他', value: 'other' }
  ];

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => documentTypes.find(t => t.value === type)?.label || type
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: '待处理',
          processing: '处理中',
          done: '已完成',
          error: '错误'
        };
        return statusMap[status] || status;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个文档吗？"
          description="删除后将无法恢复，且会影响知识问答功能。"
          onConfirm={() => handleDeleteDocument(record.uid)}
          okText="确定"
          cancelText="取消"
        >
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            loading={deletingDocId === record.uid}
          >
            删除
          </Button>
        </Popconfirm>
      )
    }
  ];

  const handleUpload = async (values) => {
    if (fileList.length === 0) {
      message.warning('请先选择要上传的文件');
      return;
    }

    if (!ollamaAvailable) {
      message.error('Ollama服务不可用，请确保Ollama已启动并加载了mxbai-embed-large模型');
      return;
    }

    if (!milvusAvailable) {
      message.error('Milvus服务不可用，请确保Milvus已启动');
      return;
    }

    try {
      setUploading(true);
      
      // 更新文件状态为处理中
      const updatedFileList = fileList.map(file => ({
        ...file,
        status: 'processing'
      }));
      setFileList(updatedFileList);

      // 处理每个文件
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.status === 'done') continue; // 跳过已处理的文件
        
        try {
          // 准备文件元数据
          const metadata = {
            fileId: file.uid,
            type: values.type || file.type,
            description: values.description || ''
          };
          
          // 处理文件并存储到向量数据库
          await processAndStoreDocument(file.originFileObj, metadata);
          
          // 更新文件状态为完成
          const updatedFile = {
            ...file,
            status: 'done',
            type: values.type || file.type,
            description: values.description || file.description,
            uploadTime: new Date().toISOString()
          };

          setFileList(prev => {
            const newList = [...prev];
            newList[i] = updatedFile;
            return newList;
          });

          // 添加到最近文档列表
          updateRecentDocuments(updatedFile);
        } catch (error) {
          console.error(`处理文件 ${file.name} 失败:`, error);
          
          // 更新文件状态为错误
          setFileList(prev => {
            const newList = [...prev];
            newList[i] = {
              ...newList[i],
              status: 'error'
            };
            return newList;
          });
        }
      }
      
      message.success('文件处理完成');
    } catch (error) {
      message.error('文件上传失败');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  // 允许的文件类型列表
  const allowedFileTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'application/javascript',
    'text/javascript',
    'text/html',
    'text/css',
    'application/json',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-c++'
  ];

  // 文件扩展名检查
  const allowedExtensions = [
    '.pdf', '.docx', '.doc', '.txt', '.md', '.js', '.py', '.java', '.c', '.cpp', '.html', '.css', '.json'
  ];

  // 文件大小限制（20MB）
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  // 检查文件类型是否允许
  const isFileTypeAllowed = (file) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + fileName.split('.').pop();
    
    return allowedFileTypes.includes(fileType) || allowedExtensions.some(ext => fileName.endsWith(ext));
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    beforeUpload: (file) => {
      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        message.error(`文件 ${file.name} 超过20MB限制，请选择更小的文件`);
        return false;
      }
      
      // 检查文件类型
      if (!isFileTypeAllowed(file)) {
        message.error(`文件 ${file.name} 类型不支持，请上传文档类型文件`);
        return false;
      }
      
      setFileList([...fileList, {
        uid: file.uid,
        name: file.name,
        status: 'pending',
        type: 'other',
        description: '',
        originFileObj: file
      }]);
      return false;
    },
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    }
  };

  return (
    <div className="document-upload">
      <Card title="文档上传" style={{ marginBottom: 24 }}>
        <Form onFinish={handleUpload}>
          <Form.Item>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传，请选择文档文件
              </p>
            </Dragger>
          </Form.Item>
          <Form.Item label="文档类型" name="type">
            <Select placeholder="请选择文档类型">
              {documentTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入文档描述" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={uploading} block>
              开始上传
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title="文档列表" 
        extra={
          <Popconfirm
            title="确定要清空所有文档吗？"
            description="清空后将无法恢复，且会影响知识问答功能。"
            onConfirm={async () => {
              try {
                await clearCollection();
                setRecentDocuments([]);
                localStorage.removeItem('recentDocuments');
                message.success('已清空所有文档');
              } catch (error) {
                message.error('清空文档失败: ' + error.message);
              }
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button danger>清空所有文档</Button>
          </Popconfirm>
        }
      >
        <Table
          columns={columns}
          dataSource={recentDocuments}
          rowKey="uid"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default DocumentManagement;