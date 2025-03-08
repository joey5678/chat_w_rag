/**
 * PDF处理服务 - 提供PDF文件解析功能
 * 在Node.js环境中处理PDF文件，避免浏览器环境的限制
 */

import * as pdfjsLib from 'pdfjs-dist';
import { fileURLToPath } from 'url';
import path from 'path';

// 在Node.js环境中设置worker
// 使用import.meta.url替代require.resolve
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置worker路径
const workerPath = `file://${path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.mjs')}`.replace(/\\/g, '/');
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

/**
 * 从PDF文件的Buffer中提取文本
 * @param {Buffer} buffer - PDF文件的Buffer数据
 * @returns {Promise<string>} - 提取的文本内容
 */
export const extractTextFromPDFBuffer = async (buffer) => {
  try {
    // 将Buffer转换为Uint8Array
    const uint8Array = new Uint8Array(buffer);
    
    // 禁用worker，在Node.js环境中使用内置处理
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      disableWorker: true  // 禁用worker，使用主线程处理
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    // 遍历所有页面并提取文本
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF文本提取失败:', error);
    throw new Error(`无法从PDF提取文本: ${error.message}`);
  }
};