/**
 * PDF处理服务 - 提供与后端PDF处理API的交互
 */

import axios from 'axios';

// 后端API基础URL
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * 通过后端API从PDF文件中提取文本
 * @param {File} file - PDF文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export const extractTextFromPDF = async (file) => {
  try {
    // 将文件转换为Base64编码
    const arrayBuffer = await file.arrayBuffer();
    // 使用浏览器兼容的方法进行Base64编码，而不是Node.js的Buffer
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    const fileBuffer = btoa(binaryString);
    
    // 调用后端API
    const response = await axios.post(`${API_BASE_URL}/pdf/extract`, { fileBuffer });
    
    if (response.data && response.data.text) {
      return response.data.text;
    }
    throw new Error('无法从PDF提取文本');
  } catch (error) {
    console.error('PDF文本提取失败:', error);
    throw new Error(`无法从PDF提取文本: ${error.message}`);
  }
};