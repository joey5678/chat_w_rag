import express from 'express';
import cors from 'cors';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { extractTextFromPDFBuffer } from './pdfService.js';

const app = express();
const port = 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Milvus配置
const MILVUS_ADDRESS = 'localhost:19530';
const COLLECTION_NAME = 'document_embeddings';
let milvusClient = null;
let milvusAvailable = false;

// 延迟初始化Milvus客户端
const initMilvusClient = async (retryCount = 1, retryDelay = 1000) => {
  for (let i = 0; i < retryCount; i++) {
    try {
      if (!milvusClient) {
        milvusClient = new MilvusClient(MILVUS_ADDRESS);
      }
      
      // 测试连接
      await milvusClient.listCollections();
      milvusAvailable = true;
      console.log('Milvus客户端初始化成功');
      return milvusClient;
    } catch (error) {
      console.error(`Milvus客户端初始化失败 (尝试 ${i + 1}/${retryCount}):`, error);
      milvusClient = null;
      milvusAvailable = false;
      
      if (i < retryCount - 1) {
        console.log(`等待 ${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw new Error(`Milvus服务连接失败，已重试 ${retryCount} 次: ${error.message}`);
      }
    }
  }
};

// 检查Milvus服务状态
app.get('/api/milvus/status', async (req, res) => {
  try {
    await initMilvusClient();
    res.json({ status: 'available' });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', error: error.message });
  }
});

// 创建集合
app.post('/api/milvus/collection', async (req, res) => {
  try {
    const client = await initMilvusClient();
    const exists = await client.hasCollection({
      collection_name: COLLECTION_NAME
    });

    if (exists.value) {
      return res.json({ message: '集合已存在' });
    }

    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          data_type: 5,
          is_primary_key: true,
          autoID: true
        },
        {
          name: 'file_id',
          data_type: 21,
          max_length: 100
        },
        {
          name: 'content',
          data_type: 21,
          max_length: 65535
        },
        {
          name: 'metadata',
          data_type: 21,
          max_length: 1024
        },
        {
          name: 'embedding',
          data_type: 101,
          dim: 1024
        }
      ]
    });

    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'embedding',
      extra_params: {
        index_type: 'HNSW',
        metric_type: 'COSINE',
        params: JSON.stringify({ M: 8, efConstruction: 64 })
      }
    });

    res.json({ message: '集合创建成功' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// 插入文档
app.post('/api/milvus/documents', async (req, res) => {
  try {
    const { documents } = req.body;
    
    // 验证documents数据
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: "The documents should be an array and length > 0." });
    }

    // 验证每个文档的必需字段
    for (const doc of documents) {
      if (!doc.fileId || !doc.content || !doc.metadata || !doc.embedding) {
        return res.status(400).json({ error: "Each document must contain fileId, content, metadata, and embedding fields." });
      }
    }

    const client = await initMilvusClient();
    
    await client.loadCollection({
      collection_name: COLLECTION_NAME
    });

    const fileIds = [];
    const contents = [];
    const metadatas = [];
    const embeddings = [];

    documents.forEach(doc => {
      fileIds.push(doc.fileId);
      contents.push(doc.content);
      metadatas.push(JSON.stringify(doc.metadata));
      embeddings.push(doc.embedding);
    });

    const fields_data = fileIds.map((fileId, index) => ({
      file_id: fileId,
      content: contents[index],
      metadata: metadatas[index],
      embedding: embeddings[index]
    }));
    // console.log(fields_data);
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      fields_data: fields_data
    });
    console.log(insertResult);
    res.json(insertResult);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// 获取最近文档
app.get('/api/milvus/recent-documents', async (req, res) => {
  try {
    const client = await initMilvusClient();

    await client.loadCollection({
      collection_name: COLLECTION_NAME
    });

    // 直接获取最新的10条记录
    const result = await client.query({
      collection_name: COLLECTION_NAME,
      output_fields: ['file_id', 'metadata'],
      expr: 'file_id != ""',  // 确保file_id不为空
      // limit: 10,
      sort_field: 'id',
      sort_order: 'DESC'
    });
    // console.log(result);
    // 使用Map进行去重，保留最新的记录
    const uniqueDocuments = new Map();
    result.data.forEach(doc => {
      const metadata = JSON.parse(doc.metadata);
      
      const key = doc.file_id;
      // console.log(key);
      const existingDoc = uniqueDocuments.get(key);
      
      if (!existingDoc || new Date(metadata.timestamp) > new Date(JSON.parse(existingDoc.metadata).timestamp)) {
        uniqueDocuments.set(key, {
          ...doc
        });
      }
    });

    // 处理查询结果，并按上传时间排序
    const recentDocuments = Array.from(uniqueDocuments.values())
      .map(doc => {
        const metadata = JSON.parse(doc.metadata);
        console.log(metadata);
        return {
          uid: doc.file_id,
          name: metadata.fileName,
          type: metadata.type,
          description: metadata.description,
          status: 'done',
          uploadTime: metadata.timestamp
        };
      })
      .sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime))
      .slice(0, 10);

    res.json(recentDocuments);
  } catch (error) {
    console.error('获取最近文档失败:', error);
    res.status(503).json({ error: error.message });
  }
});

// 搜索文档
app.post('/api/milvus/search', async (req, res) => {
  try {
    console.log('【搜索API】接收到搜索请求');
    const { queryEmbedding, topK = 5, fileIds = [] } = req.body;
    
    // 检查嵌入向量维度
    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      console.error('【搜索API错误】查询嵌入向量无效:', queryEmbedding);
      return res.status(400).json({ error: '查询嵌入向量无效' });
    }
    
    console.log(`【搜索API】查询嵌入向量维度: ${queryEmbedding.length}`);
    console.log(`【搜索API】请求参数: topK=${topK}, fileIds长度=${fileIds.length}`);
    
    const client = await initMilvusClient();

    // 获取集合信息，检查嵌入维度
    try {
      const collectionInfo = await client.describeCollection({
        collection_name: COLLECTION_NAME
      });
      console.log('【搜索API】集合信息:', JSON.stringify(collectionInfo));
      
      // 查找embedding字段的维度
      const embeddingField = collectionInfo.schema.fields.find(field => field.name === 'embedding');
      if (embeddingField) {
        console.log(`【搜索API】集合中embedding字段维度: ${embeddingField.dim}`);
        
        // 检查维度是否匹配
        if (embeddingField.dim != queryEmbedding.length) {
          console.error(`【搜索API错误】嵌入维度不匹配: 查询=${queryEmbedding.length}, 集合=${embeddingField.dim}`);
          return res.status(400).json({ 
            error: `嵌入维度不匹配: 查询=${queryEmbedding.length}, 集合=${embeddingField.dim}` 
          });
        }
      }
    } catch (infoError) {
      console.error('【搜索API错误】获取集合信息失败:', infoError);
    }

    await client.loadCollection({
      collection_name: COLLECTION_NAME
    });
    console.log('【搜索API】集合加载成功');

    // 检查索引信息
    try {
      const indexInfo = await client.describeIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding'
      });
      console.log('【搜索API】索引信息:', JSON.stringify(indexInfo));
    } catch (indexError) {
      console.error('【搜索API错误】获取索引信息失败:', indexError);
    }

    // 构建搜索表达式，如果提供了fileIds，则按文件ID过滤
    let expr = '';
    if (fileIds && fileIds.length > 0) {
      // 构建IN表达式: file_id in ["id1", "id2", ...]
      const fileIdsStr = fileIds.map(id => `"${id}"`).join(', ');
      expr = `file_id in [${fileIdsStr}]`;
      console.log(`【搜索API】按文件ID过滤搜索: ${expr}`);
    }

    console.log('【搜索API】开始执行搜索...');
    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      data: [queryEmbedding],
      anns_field: 'embedding',
      limit: topK,
      output_fields: ['file_id', 'content', 'metadata'],
      //search_params: {
      //  metric_type: 'COSINE',
      //  params: JSON.stringify({ ef: 64 })
      //},
      expr: expr || undefined
    });
    
    console.log(`【搜索API】搜索完成，结果数量: ${searchResult.results ? searchResult.results.length : 0}`);
    if (searchResult.results && searchResult.results.length > 0) {
      console.log('【搜索API】搜索结果示例:', JSON.stringify(searchResult.results[0]));
    } else {
      console.log('【搜索API】未找到匹配结果');
    }

    const results = searchResult.results.map(result => ({
      id: result.id,
      score: result.score,
      fileId: result.file_id,
      content: result.content,
      metadata: JSON.parse(result.metadata)
    }));

    res.json(results);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// 删除文档
app.delete('/api/milvus/document/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: '缺少文件ID' });
    }
    
    console.log(`【删除API】开始删除文件ID: ${fileId}`);
    
    const client = await initMilvusClient();
    
    await client.loadCollection({
      collection_name: COLLECTION_NAME
    });
    
    // 构建删除表达式
    const expr = `file_id == "${fileId}"`;
    console.log(`【删除API】删除表达式: ${expr}`);
    
    // 修复：确保使用正确的参数格式传递expr
    const deleteResult = await client.delete({
      collection_name: COLLECTION_NAME,
      expr: expr,
      filter: expr // 添加filter参数作为备选
    });
    
    console.log(`【删除API】删除结果:`, deleteResult);
    
    res.json({ success: true, message: `文档 ${fileId} 已删除` });
  } catch (error) {
    console.error('删除文档失败:', error);
    res.status(503).json({ error: error.message });
  }
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

app.listen(port, () => {
  console.log(`后端服务器运行在 http://localhost:${port}`);
  console.log('正在尝试连接Milvus服务...');
  initMilvusClient()
    .then(() => {
      console.log('Milvus服务连接成功');
    })
    .catch(error => {
      console.error('Milvus服务连接失败:', error.message);
      console.log('服务器将继续运行，但Milvus相关功能将不可用，请确保Milvus服务已启动');
    });
});

// PDF文本提取API
app.post('/api/pdf/extract', async (req, res) => {
  try {
    const { fileBuffer } = req.body;
    
    if (!fileBuffer) {
      return res.status(400).json({ error: '缺少文件数据' });
    }
    
    // 将Base64编码的文件数据转换为Buffer
    const buffer = Buffer.from(fileBuffer, 'base64');
    
    // 使用PDF.js在服务器端提取文本
    const extractedText = await extractTextFromPDFBuffer(buffer);
    
    res.json({ text: extractedText });
  } catch (error) {
    console.error('PDF处理失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 清空集合
app.post('/api/milvus/clear-collection', async (req, res) => {
  try {
    const client = await initMilvusClient();
    
    await client.loadCollection({
      collection_name: COLLECTION_NAME
    });

    await client.delete({
      collection_name: COLLECTION_NAME,
      filter: 'id >= 0'
    });

    res.json({ success: true, message: '集合已清空' });
  } catch (error) {
    console.error('清空集合失败:', error);
    res.status(503).json({ error: error.message });
  }
});