/**
 * 文档处理服务 - 提供文档内容提取、分块和向量化功能
 */

import mammoth from 'mammoth';
import axios from 'axios';
import { getEmbedding, getBatchEmbeddings } from './ollamaService';
import { insertDocuments } from './milvusService';
import { extractTextFromPDF } from './pdfService';

// 文本分块的最大长度
const MAX_CHUNK_SIZE = 1000;

// extractTextFromPDF 已从 pdfService.js 导入，使用后端API处理PDF

/**
 * 从Word文档中提取文本
 * @param {File} file - Word文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export const extractTextFromWord = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Word文本提取失败:', error);
    throw new Error(`无法从Word文档提取文本: ${error.message}`);
  }
};

/**
 * 从文本文件中提取文本
 * @param {File} file - 文本文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export const extractTextFromText = async (file) => {
  try {
    const text = await file.text();
    return text;
  } catch (error) {
    console.error('文本文件读取失败:', error);
    throw new Error(`无法读取文本文件: ${error.message}`);
  }
};

/**
 * 根据文件类型提取文本
 * @param {File} file - 文件对象
 * @returns {Promise<string>} - 提取的文本内容
 */
export const extractTextFromFile = async (file) => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
             fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return extractTextFromWord(file);
  } else if (fileType === 'text/plain' || fileName.endsWith('.txt') || 
             fileName.endsWith('.md') || fileName.endsWith('.js') || 
             fileName.endsWith('.py') || fileName.endsWith('.java') || 
             fileName.endsWith('.c') || fileName.endsWith('.cpp') || 
             fileName.endsWith('.html') || fileName.endsWith('.css')) {
    return extractTextFromText(file);
  } else {
    throw new Error(`不支持的文件类型: ${fileType}`);
  }
};

/**
 * 将文本分割成块
 * @param {string} text - 要分割的文本
 * @param {number} maxChunkSize - 每块的最大字符数
 * @returns {Array<string>} - 文本块数组
 */
export const splitTextIntoChunks = (text, maxChunkSize = MAX_CHUNK_SIZE) => {
  if (!text || text.length === 0) {
    return [];
  }
  
  // 按段落分割
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // 如果段落本身超过最大块大小，则需要进一步分割
    if (paragraph.length > maxChunkSize) {
      // 先添加当前累积的块
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // 分割长段落
      let remainingParagraph = paragraph;
      while (remainingParagraph.length > 0) {
        const chunkText = remainingParagraph.slice(0, maxChunkSize);
        chunks.push(chunkText);
        remainingParagraph = remainingParagraph.slice(maxChunkSize);
      }
    } 
    // 如果添加当前段落会超过最大块大小，则开始新块
    else if (currentChunk.length + paragraph.length + 1 > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } 
    // 否则将段落添加到当前块
    else {
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  // 添加最后一个块
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

/**
 * 处理文件并存储到向量数据库
 * @param {File} file - 文件对象
 * @param {Object} metadata - 文件元数据
 * @returns {Promise<Object>} - 处理结果
 */
export const processAndStoreDocument = async (file, metadata) => {
  try {
    // 1. 提取文本
    const text = await extractTextFromFile(file);
    
    // 2. 分块
    const chunks = splitTextIntoChunks(text);
    
    // 3. 获取嵌入向量
    const embeddings = await getBatchEmbeddings(chunks);
    
    // 4. 准备文档数据
    const documents = chunks.map((chunk, index) => ({
      fileId: metadata.fileId || file.name,
      content: chunk,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        timestamp: new Date().toISOString()
      },
      embedding: embeddings[index]
    }));
    
    // 5. 存储到Milvus
    const result = await insertDocuments(documents);
    
    return {
      success: true,
      fileId: metadata.fileId || file.name,
      chunksCount: chunks.length,
      insertResult: result
    };
  } catch (error) {
    console.error('文档处理失败:', error);
    throw error;
  }
};