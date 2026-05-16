# 影刀调度运维台

一个面向本地运维和排障场景的影刀仪表盘项目。  
项目使用 `NestJS + React + Vite` 构建，通过影刀开放平台接口查询应用、任务、机器人、执行记录与日志。

## 项目目标

- 把常见的影刀查询和排查动作集中到一个本地工具中
- 通过统一后端代理影刀接口，避免在前端直接暴露访问凭证
- 支持从多种视角查看数据，包括应用、任务、机器人和时间线
- 为后续扩展任务控制、执行排查、日志检索打基础

## 功能概览

- 凭证设置
  保存 `apiBaseUrl`、`accessKeyId`、`accessKeySecret` 和账号名称
- 多主视图
  提供应用视图、任务视图、机器人视图、时间线视图
- 关联信息浏览
  支持查看应用和任务、机器人和任务之间的关系
- 任务执行排查
  可查询执行记录、任务详情、流程详情、机器人任务队列、任务结果
- 日志检索
  支持任务日志搜索与按 `requestId` 查询日志结果
- 保存视图
  支持把当前筛选、字段、排序和模块配置保存到本地浏览器
- Excel 导出
  支持导出当前列表数据


## 技术栈

- 后端：`NestJS`、`@nestjs/axios`、`axios`
- 前端：`React 18`、`TypeScript`、`Vite`
- 数据导出：`xlsx`
- 桌面壳：`Electron`、`electron-builder`
- 包管理：`npm workspaces`

## 目录结构

```text
.
├── apps
│   ├── backend        # NestJS 后端
│   └── frontend       # React + Vite 前端
├── desktop            # Electron 主进程
├── docs               # 设计/打包说明
├── release            # 桌面打包产物（忽略）
└── package.json       # workspace 根配置
```

## 运行要求

- Node.js 18 或更高版本
- npm 9 或更高版本
- 可访问影刀开放平台接口

## 快速开始

1. 安装依赖

```bash
cd /Users/Simone/develop/影刀/开放平台/yingdao-dashboard
npm install
```

2. 启动后端

```bash
npm run start:backend
```

3. 启动前端

```bash
npm run start:frontend
```

4. 打开浏览器

```text
http://localhost:5174
```

如果你希望同时启动前后端，也可以直接使用：

```bash
npm run start
```

## 首次使用

1. 打开“凭证设置”
2. 填写以下字段
   - `apiBaseUrl`
   - `accessKeyId`
   - `accessKeySecret`
   - `accountName`（可选）
3. 点击“保存凭证”
4. 切换到应用、任务、机器人或时间线视图开始加载数据

默认 `apiBaseUrl` 为：

```text
https://api.yingdao.com
```

## 视图说明

### 应用视图

- 查看应用列表
- 展开应用查看其关联任务
- 查询应用运行记录

### 任务视图

- 查看调度任务列表
- 查看任务详情
- 查询最近执行记录
- 执行任务启动、停止、重试、结果查询

### 机器人视图

- 查看机器人列表
- 查看机器人详情
- 查看机器人任务队列和关联任务

### 时间线视图

- 从时间维度观察任务运行情况
- 支持日期和机器维度切换
- 支持模块显示顺序与可见性调整

### 调试视图

- 基础调试页：用于直接触发和观察接口
- 详细调试页：用于更深入的排查与数据检查

## 保存视图

主视图支持将以下配置保存到本地浏览器：

- 当前筛选条件
- 当前排序状态
- 当前显示字段
- 当前模块显示配置

这部分数据保存在浏览器本地，不进入后端存储。

## 凭证存储与安全

为了避免把真实凭证提交到 Git 仓库，当前实现采用“示例文件 + 本地忽略文件”的方式：

- 示例文件：`apps/backend/data/credentials.example.json`
- 本地真实凭证：`apps/backend/data/credentials.local.json`

说明：

- 真实凭证保存到本地忽略文件，不会被 `git add .` 提交
- 仓库只保留示例文件，便于说明结构
- 后端优先读取本地凭证文件
- 旧版本如果曾经把凭证写到错误路径，可能遗留：
  `apps/backend/apps/backend/data/credentials.json`

如果你准备发布到 GitHub，建议执行一次检查：

```bash
git status --ignored
git add -n .
```

## 开发命令

### 根目录

```bash
npm run start
npm run start:backend
npm run start:frontend
npm run build:backend
npm run build:frontend
npm run build:desktop
npm run desktop
npm run package
npm run package:mac
npm run package:win
```

### 作用说明

- `npm run start`
  同时启动前后端开发服务
- `npm run build:backend`
  编译后端 TypeScript
- `npm run build:frontend`
  构建前端静态资源
- `npm run build:desktop`
  构建桌面应用所需前后端产物
- `npm run desktop`
  本地运行 Electron 桌面应用
- `npm run package`
  打包当前平台桌面应用

## 本地开发说明

- 后端端口：`3001`
- 前端端口：`5174`
- 前端开发时通过 Vite 代理 `/api` 到后端
- 后端作为影刀开放平台的代理层，负责凭证读取、access token 获取和接口转发

后端内部还做了两件对稳定性有帮助的事：

- access token 缓存
- token 获取并发去重与部分重试

## 后端 API

当前后端暴露的主要接口如下。

### 基础与凭证

- `GET /api/yingdao/status` - 服务健康检查
- `GET /api/yingdao/credentials` - 读取已保存凭证
- `POST /api/yingdao/credentials` - 保存凭证
- `POST /api/yingdao/token` - 获取 access token

### 应用相关

- `GET /api/yingdao/apps` - 查询应用列表
- `POST /api/yingdao/apps/run-records` - 查询应用运行记录
- `POST /api/yingdao/app/params` - 查询应用参数

### 任务相关

- `GET /api/yingdao/tasks` - 查询任务列表
- `POST /api/yingdao/task/detail` - 查询任务详情
- `POST /api/yingdao/task/executions` - 查询任务执行记录
- `POST /api/yingdao/tasks/newest` - 查询最新任务执行记录
- `POST /api/yingdao/task/process-detail` - 查询任务流程详情
- `POST /api/yingdao/task/start` - 启动任务
- `POST /api/yingdao/task/stop` - 停止任务
- `POST /api/yingdao/task/retry` - 重试任务
- `POST /api/yingdao/task/query` - 查询任务执行结果

### 机器人相关

- `GET /api/yingdao/robots` - 查询机器人列表
- `POST /api/yingdao/robot/detail` - 查询机器人详情
- `POST /api/yingdao/robot/jobs` - 查询机器人任务队列

### 日志相关

- `POST /api/yingdao/job/logs/search` - 搜索任务日志
- `GET /api/yingdao/job/logs/query` - 按 `requestId` 查询日志结果

## 桌面打包

项目支持把前端和后端一起打成桌面应用，适合发给本地使用者直接双击运行。

常用命令：

```bash
npm run build:desktop
npm run desktop
npm run package
npm run package:mac
npm run package:win
```

打包产物目录：

```text
release/
```

更多细节可以看：

- [docs/packaging-desktop.md](/Users/Simone/develop/影刀/开放平台/yingdao-dashboard/docs/packaging-desktop.md:1)

## 文档索引

- [docs/packaging-desktop.md](/Users/Simone/develop/影刀/开放平台/yingdao-dashboard/docs/packaging-desktop.md:1) - 桌面打包说明
- [docs/yingdao-api-map.md](/Users/Simone/develop/影刀/开放平台/yingdao-dashboard/docs/yingdao-api-map.md:1) - 影刀接口映射说明

## 常见问题

### 1. 页面打开了但没有数据

优先检查：

- 后端是否已经启动
- 凭证是否填写正确
- `apiBaseUrl` 是否可访问
- 当前账号是否有对应接口权限

