# TurquoiseLight

Turquoise项目的轻量化版本，专注于提供本地化的文言文学习体验，集成了AI辅助功能，帮助用户更好地理解和学习文言文。

## 项目架构

### 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **状态管理**：Vue 3 Composition API + refs
- **样式**：CSS3 + 自定义属性
- **AI集成**：SiliconFlow API (DeepSeek-R1-Distill-Qwen-7B模型)
- **本地存储**：localStorage
- **边缘函数**：EdgeOne Edge Functions (用于未来的后端功能)

### 项目结构

```
turquoise/
├── edge-functions/       # 边缘函数（后端API）
│   ├── api/             # API路由
│   │   ├── articles/     # 文章相关API
│   │   └── auth/         # 认证相关API
│   ├── db.js            # 数据库连接
│   └── index.js         # 边缘函数入口
├── public/              # 静态资源
├── src/                 # 前端源码
│   ├── assets/          # 静态资源
│   ├── components/      # 组件
│   │   ├── Reader.vue   # 阅读器组件（核心）
│   │   ├── AIChat.vue   # AI聊天组件
│   │   └── ArticleList.vue # 文章列表组件
│   ├── composables/     # 组合式函数
│   │   ├── useArticles.ts # 文章管理
│   │   ├── useAuth.ts   # 认证管理
│   │   └── useSettings.ts # 设置管理
│   ├── types/           # TypeScript类型定义
│   ├── utils/           # 工具函数
│   ├── App.vue          # 应用根组件
│   └── main.ts          # 应用入口
├── package.json         # 项目配置
└── vite.config.ts       # Vite配置
```

## 核心功能模块

### 1. 阅读器模块

**功能**：
- 文言文文本展示
- 注释管理（添加、编辑、删除注释）
- 文本格式化（加粗、下划线）
- AI辅助注释（选中文本后AI自动生成注释）
- 词典查询（选中文本后快速查词典）
- 聊天记录管理（AI聊天会话管理）

**实现方案**：
- 使用 `Reader.vue` 组件作为核心，负责文本渲染和交互
- 通过 `useArticles` composable 管理文章和注释数据
- 使用 `localStorage` 存储文章和注释数据
- 集成AI API实现智能注释和问答功能

### 2. AI功能模块

**功能**：
- AI聊天（支持多轮对话）
- 选中文本AI注释
- 选中文本AI问答
- 聊天会话管理（创建、重命名、删除会话）
- 聊天记录导出（TXT、JSON格式）

**实现方案**：
- 使用 `AIChat.vue` 组件处理AI聊天界面
- 通过 `Reader.vue` 中的AI注释功能处理选区注释
- 使用 `localStorage` 存储聊天会话数据
- 集成SiliconFlow API实现AI交互
- 支持流式响应，提升用户体验

### 3. 文章管理模块

**功能**：
- 文章列表展示
- 文章创建和编辑
- 文章分类管理
- 文章导入导出

**实现方案**：
- 使用 `ArticleList.vue` 组件展示文章列表
- 通过 `useArticles` composable 管理文章数据
- 使用 `localStorage` 存储文章数据
- 支持文章的CRUD操作

### 4. 词典模块

**功能**：
- 本地词典查询
- 词条管理
- 选中文本快速查词典

**实现方案**：
- 使用 `Dictionary.vue` 组件展示词典界面
- 通过 `useArticles` composable 管理词典数据
- 基于文章注释自动构建词典
- 支持实时搜索和过滤

## 实现方案

### 1. 数据存储

- **本地存储**：使用 `localStorage` 存储文章、注释和聊天会话数据
- **数据结构**：
  - 文章：包含id、标题、内容、注释、格式等字段
  - 注释：包含id、文本、内容、位置等字段
  - 聊天会话：包含id、标题、消息、时间戳等字段

### 2. AI集成

- **API调用**：使用SiliconFlow API调用DeepSeek-R1-Distill-Qwen-7B模型
- **提示词设计**：针对不同场景设计专门的提示词，如注释生成、文本解释等
- **流式响应**：支持AI响应的流式传输，提升用户体验
- **思考过程处理**：处理AI模型的思考过程，提取实际输出内容

### 3. 用户界面

- **响应式设计**：适配不同屏幕尺寸
- **现代化交互**：使用过渡动画、悬停效果等提升用户体验
- **侧边栏布局**：可调整宽度的侧边栏，集成设置、注释、词典、AI聊天等功能
- **上下文菜单**：右键菜单集成常用功能，如查词典、AI注释等

### 4. 性能优化

- **懒加载**：组件和资源的懒加载
- **防抖和节流**：优化输入和滚动事件
- **缓存策略**：缓存AI响应和常用数据
- **虚拟列表**：处理长列表数据

## 部署说明

### 本地开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

### 边缘函数部署

项目包含EdgeOne边缘函数，用于未来的后端功能，如用户认证、文章分享等。部署步骤：

1. 配置 `edgeone.json` 文件
2. 使用EdgeOne CLI部署边缘函数

## 开发指南

### 代码规范

- 使用TypeScript类型定义
- 遵循Vue 3 Composition API最佳实践
- 组件命名使用PascalCase
- 文件命名使用kebab-case

### 功能扩展

1. **添加新组件**：在 `src/components/` 目录下创建新组件
2. **添加新功能**：在 `src/composables/` 目录下创建新的组合式函数
3. **添加新API**：在 `edge-functions/api/` 目录下创建新的API路由

### 测试

- 使用Vue Test Utils进行组件测试
- 使用Jest进行单元测试
- 手动测试主要功能流程

## 未来规划

1. **用户系统**：实现用户注册、登录和个人中心
2. **文章广场**：用户可以分享和下载文章
3. **多语言支持**：支持中英文界面切换
4. **离线功能**：PWA支持，实现离线使用
5. **更多AI功能**：如文本翻译、文章总结等

## 贡献

欢迎提交Issue和Pull Request，帮助改进项目。

## 许可证

MIT License
