/**
 * Milvus服务 - 提供与Milvus数据库交互的功能
 * 主要用于向量存储和检索
 */

import axios from 'axios';

// 后端API基础URL
const API_BASE_URL = 'http://localhost:3000/api/milvus';

/**
 * 检查Milvus服务是否可用
 * @returns {Promise<boolean>} - 返回服务是否可用
 */
export const checkMilvusService = async (retryCount = 3, retryDelay = 1000) => {
  for (let i = 0; i < retryCount; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/status`, {
        timeout: 5000 // 5秒超时
      });
      if (response.data.status === 'available') {
        return true;
      }
      throw new Error('Milvus服务状态异常');
    } catch (error) {
      console.error(`Milvus服务检查失败 (尝试 ${i + 1}/${retryCount}):`, error);
      
      if (i < retryCount - 1) {
        console.log(`等待 ${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  return false;
};

/**
 * 创建文档向量集合
 * @returns {Promise<boolean>} - 创建是否成功
 */
export const createDocumentCollection = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/collection`);
    console.log(response.data.message);
    return true;
  } catch (error) {
    console.error('创建集合失败:', error);
    throw error;
  }
};

/**
 * 插入文档向量数据
 * @param {Array<Object>} documents - 文档数据数组
 * @returns {Promise<Array>} - 插入结果
 */
export const insertDocuments = async (documents) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/documents`, { documents });
    console.log(`成功插入 ${response.data.insert_cnt} 条文档数据`);
    return response.data;
  } catch (error) {
    console.error('插入文档数据失败:', error);
    throw error;
  }
};

/**
 * 根据向量相似度搜索文档
 * @param {Array<number>} queryEmbedding - 查询向量
 * @param {number} topK - 返回结果数量
 * @param {Array<string>} [fileIds] - 可选的文件ID列表，用于过滤搜索范围
 * @returns {Promise<Array>} - 搜索结果
 */
export const searchSimilarDocuments = async (queryEmbedding, topK = 5, fileIds = []) => {
  try {
    // 验证查询向量
    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      console.error('【Milvus搜索错误】查询向量无效:', queryEmbedding);
      throw new Error('查询向量无效');
    }
    
    console.log(`【Milvus搜索】开始搜索，查询向量维度: ${queryEmbedding.length}`);
    console.log(`【Milvus搜索】topK: ${topK}, 文件ID过滤: ${fileIds.length > 0 ? fileIds.join(', ') : '无'}`);
    
    const response = await axios.post(`${API_BASE_URL}/search`, { queryEmbedding, topK, fileIds });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`【Milvus搜索】搜索成功，返回结果数量: ${response.data.length}`);
      if (response.data.length === 0) {
        console.log('【Milvus搜索】警告: 未找到匹配结果，可能原因:');
        console.log('  1. 嵌入维度不匹配');
        console.log('  2. 文件ID过滤条件过严');
        console.log('  3. 向量数据库中没有相关文档');
      }
    } else {
      console.error('【Milvus搜索错误】响应格式异常:', response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('【Milvus搜索错误】搜索文档失败:', error);
    if (error.response) {
      console.error('【Milvus搜索错误】服务器响应:', error.response.data);
    }
    throw error;
  }
};

/**
 * 删除集合中的所有数据
 * @returns {Promise<boolean>} - 删除是否成功
 */
/**
 * 获取最近的文档列表
 * @returns {Promise<Array>} - 最近的文档列表
 */
export const getRecentDocuments = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/recent-documents`);
    return response.data;
  } catch (error) {
    console.error('获取最近文档失败:', error);
    throw error;
  }
};

export const clearCollection = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/clear-collection`);
    return response.data.success;
  } catch (error) {
    console.error('清空集合失败:', error);
    throw error;
  }
};