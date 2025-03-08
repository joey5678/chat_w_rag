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
export const checkMilvusService = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/status`);
    return response.data.status === 'available';
  } catch (error) {
    console.error('Milvus服务检查失败:', error);
    return false;
  }
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
 * @returns {Promise<Array>} - 搜索结果
 */
export const searchSimilarDocuments = async (queryEmbedding, topK = 5) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/search`, { queryEmbedding, topK });
    return response.data;
  } catch (error) {
    console.error('搜索文档失败:', error);
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
    const client = await initMilvusClient();
    const exists = await hasCollection();
    
    if (exists) {
      await client.dropCollection({
        collection_name: COLLECTION_NAME
      });
      console.log(`集合 ${COLLECTION_NAME} 已清空`);
      
      // 重新创建集合
      await createDocumentCollection();
      return true;
    }
    return false;
  } catch (error) {
    console.error('清空集合失败:', error);
    throw error;
  }
};