/**
 * 格式化工具 - 提供代码高亮和Markdown渲染功能
 */

import hljs from 'highlight.js';
import { marked } from 'marked';
import 'highlight.js/styles/github.css'; // 导入默认样式，可以根据需要更换

/**
 * 检测文本是否包含代码块
 * @param {string} text - 要检测的文本
 * @returns {boolean} - 是否包含代码块
 */
export const containsCodeBlock = (text) => {
  // 检测是否包含Markdown风格的代码块 ```language ... ```
  return /```[\s\S]*?```/.test(text);
};

/**
 * 检测文本是否为Markdown格式
 * @param {string} text - 要检测的文本
 * @returns {boolean} - 是否为Markdown格式
 */
export const isMarkdown = (text) => {
  if (!text) return false;
  
  // 检测常见的Markdown语法
  const markdownPatterns = [
    /^#+ .*$/m, // 标题
    /^\* .*$/m, // 无序列表
    /^- .*$/m, // 无序列表（短横线格式）
    /^\d+\. .*$/m, // 有序列表
    /^> .*$/m, // 引用
    /\[.*\]\(.*\)/, // 链接
    /\*\*.*\*\*/, // 粗体
    /\*.*\*/, // 斜体
    /`[^`]+`/, // 行内代码
    /```[\s\S]*?```/, // 代码块
    /^---$/m, // 分隔线
    /^\|.*\|.*\|/m, // 表格
    /^\s*- \[ \].*$/m, // 任务列表（未完成）
    /^\s*- \[x\].*$/m // 任务列表（已完成）
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
};

/**
 * 格式化代码块
 * @param {string} text - 包含代码块的文本
 * @returns {string} - 格式化后的HTML
 */
export const formatCodeBlocks = (text) => {
  // 替换Markdown风格的代码块
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, language, code) => {
    try {
      // 如果指定了语言且hljs支持该语言
      if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre class="hljs-pre"><code class="hljs language-${language}">${highlighted}</code></pre>`;
      } else {
        // 自动检测语言
        const highlighted = hljs.highlightAuto(code).value;
        return `<pre class="hljs-pre"><code class="hljs">${highlighted}</code></pre>`;
      }
    } catch (error) {
      console.error('代码高亮处理失败:', error);
      // 如果高亮失败，至少保留代码块格式
      return `<pre class="hljs-pre"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    }
  });
};

/**
 * 渲染Markdown文本为HTML
 * @param {string} text - Markdown文本
 * @returns {string} - 渲染后的HTML
 */
export const renderMarkdown = (text) => {
  try {
    // 配置marked选项，使用highlight.js进行代码高亮
    marked.setOptions({
      highlight: (code, lang) => {
        try {
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          } else {
            return hljs.highlightAuto(code).value;
          }
        } catch (error) {
          console.error('Markdown代码高亮失败:', error);
          return code;
        }
      },
      breaks: true, // 允许换行
      gfm: true, // 启用GitHub风格的Markdown
      headerIds: true, // 为标题添加ID
      mangle: false, // 不转义内联HTML
      pedantic: false, // 不使用pedantic模式（更符合CommonMark规范）
      smartLists: true, // 使用更智能的列表行为
      smartypants: true, // 使用更智能的标点符号
      xhtml: false // 不使用自闭合标签
    });
    
    return marked.parse(text);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return text;
  }
};

/**
 * 处理消息内容，应用适当的格式化
 * @param {string} content - 消息内容
 * @returns {Object} - 格式化后的内容和类型信息
 */
export const formatMessageContent = (content) => {
  if (!content) return { content, isFormatted: false };
  
  // 检查是否包含代码块
  const hasCodeBlock = containsCodeBlock(content);
  
  // 检查是否为Markdown格式
  const hasMarkdown = isMarkdown(content);
  
  // 如果包含代码块或是Markdown格式，进行相应处理
  if (hasCodeBlock || hasMarkdown) {
    const formattedContent = renderMarkdown(content);
    return { content: formattedContent, isFormatted: true };
  }
  
  // 如果是普通文本，直接返回
  return { content, isFormatted: false };
};