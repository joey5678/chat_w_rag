# 个人知识库 RAG 系统

基于向量数据库的个人知识库检索增强生成（RAG）系统，支持多种文档格式的处理和语义检索。

## 功能特点

- 支持PDF、Word、文本等多种文档格式
- 文档自动分块和向量化存储
- 基于语义的相似度检索
- 实时文档处理和更新

## 技术栈

- 前端：React + Vite + Ant Design
- 后端：Express.js
- 向量数据库：Milvus
- 文本嵌入：Ollama (mxbai-embed-large)

## 系统架构

- `/src`: 前端源代码
  - `/components`: 公共组件
  - `/pages`: 页面组件
  - `/services`: 服务层接口
- `/server`: 后端服务
  - `index.js`: 主服务器入口
  - `pdfService.js`: PDF处理服务

## 安装和运行

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
# 启动前端开发服务器
npm run dev

# 启动后端服务器
npm run server
```

3. 确保Milvus和Ollama服务已启动

## 使用说明

1. 文档管理：上传并处理文档
2. 文档检索：基于语义相似度搜索文档内容

## 依赖服务

- Milvus 向量数据库
- Ollama (mxbai-embed-large 模型)

## 注意事项

- 确保Milvus服务在本地19530端口运行
- 确保Ollama服务在本地11434端口运行
- 确保已加载mxbai-embed-large模型