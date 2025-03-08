/**
 * Ollama服务 - 提供与Ollama API交互的功能
 */

import axios from 'axios';

// Ollama API的基础URL
const OLLAMA_BASE_URL = 'http://localhost:11434';

/**
 * 获取可用的模型列表
 * @returns {Promise<Array>} - 返回可用模型列表
 */
export const getAvailableModels = async () => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
    if (response.data && Array.isArray(response.data.models)) {
      return response.data.models;
    }
    return [];
  } catch (error) {
    console.error('获取模型列表失败:', error);
    throw error;
  }
};

/**
 * 与模型进行对话
 * @param {string} prompt - 用户输入的文本
 * @param {string} model - 使用的模型名称
 * @param {Array} history - 对话历史记录
 * @returns {Promise<string>} - 返回模型的回复
 */
export const chat = async (prompt, model, history = []) => {
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/chat`, {
      model,
      messages: [
        ...history,
        { role: 'user', content: prompt }
      ]
    });

    if (response.data && response.data.message) {
      return response.data.message.content;
    }
    throw new Error('无效的响应格式');
  } catch (error) {
    console.error('聊天请求失败:', error);
    throw error;
  }
};

/**
 * 获取文本的嵌入向量
 * @param {string} text - 需要嵌入的文本
 * @returns {Promise<Array<number>>} - 返回嵌入向量
 */
export const getEmbedding = async (text) => {
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
      model: 'mxbai-embed-large',
      prompt: text
    });
    
    if (response.data && response.data.embedding) {
      return response.data.embedding;
    }
    throw new Error('无法获取嵌入向量');
  } catch (error) {
    console.error('获取嵌入向量失败:', error);
    throw error;
  }
};

/**
 * 批量获取文本的嵌入向量
 * @param {Array<string>} texts - 需要嵌入的文本数组
 * @returns {Promise<Array<Array<number>>>} - 返回嵌入向量数组
 */
export const getBatchEmbeddings = async (texts) => {
  try {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await getEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  } catch (error) {
    console.error('批量获取嵌入向量失败:', error);
    throw error;
  }
};

/**
 * 检查Ollama服务是否可用
 * @returns {Promise<boolean>} - 返回服务是否可用
 */
export const checkOllamaService = async () => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
    return response.status === 200;
  } catch (error) {
    console.error('Ollama服务检查失败:', error);
    return false;
  }
};