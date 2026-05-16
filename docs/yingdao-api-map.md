# Yingdao API Map

本文件是 `yingdao-dashboard` 的接口真值索引。

规则：
- 官方网页文档是参数和字段真值来源
- `../影刀.json` 是整理后的可导入 Postman collection
- 本地前端只通过 `/api/yingdao/*` 调本地 Nest 代理，不直接打上游 Yingdao

## 易混字段

- `scheduleUuid`: 调度定义 UUID。用于 `schedule/list`、`schedule/detail`、`task/start`，也是 `task/list.sourceUuid` 的常见来源。
- `taskUuid`: 任务运行 UUID。用于 `task/process/detail`、`task/query`、`task/stop`、`task/retry`。
- `sourceUuid`: 执行来源 UUID。`task/list` 使用，通常等于 `scheduleUuid`。
- `robotClientUuid`: 机器 UUID。用于 `client/query`、`job/list`、`task/process/detail`。
- `robotUuid`: 应用 UUID。常见于 `schedule/detail.robotList`。
- `appId`: 应用开放平台 UUID。`app/open/query/list`、`app/open/query/use/record/list` 使用。项目内已把 `appId` 作为应用主键，`robotUuid` 只保留兼容映射。

## 接口矩阵

| 上游接口 | 方法 | 正确请求参数 | 频率限制 | 本地代理 | 前端消费位置 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `/oapi/token/v2/token/create` | GET | `accessKeyId`, `accessKeySecret` | 20/s | `/api/yingdao/token` | 凭证校验、后端统一鉴权 | 后端带缓存和并发去重 |
| `/oapi/app/open/query/list` | POST | `appId`, `size`, `page`, `ownerUserSearchKey`, `appName` | 5/s | `/api/yingdao/apps` | `fetchDashboardBaseData`, `DebugView`, `DetailedDebugView` | 应用主实体来源；后端代理按 `page.pages` 限速拉全量 |
| `/oapi/app/open/query/use/record/list` | POST | `appId`, `size`, `minId`, `beginDate`, `endDate` | 5/s | `/api/yingdao/apps/run-records` | 应用视图最近状态、最近调用、调试页 | `appId` 与时间窗口至少一组 |
| `/oapi/dispatch/v2/client/list` | POST | `status`, `key`, `robotClientGroupUuid`, `page`, `size` | 10/s | `/api/yingdao/robots` | 机器视图、调试页 | 项目默认不传 `status` |
| `/oapi/dispatch/v2/client/query` | POST | `accountName` 或 `robotClientUuid` | 20/s | `/api/yingdao/robot/detail` | 机器抽屉 | 二选一即可 |
| `/oapi/dispatch/v2/schedule/list` | POST | `key`, `enabled`, `scheduleType`, `page`, `size` | 10/s | `/api/yingdao/tasks` | 任务视图、时间视图、调试页 | 用 `scheduleType`，不要混 `type` |
| `/oapi/dispatch/v2/schedule/detail` | POST | `scheduleUuid` | 10/s | `/api/yingdao/task/detail` | 任务/应用/机器关联映射、调试页 | 任务详情只认 `scheduleUuid` |
| `/oapi/dispatch/v2/task/newest/list` | POST | `statusList`, `startTime`, `endTime`, `page`, `size` | 5/s | `/api/yingdao/tasks/newest` | 最近执行、时间视图、调试页 | 主数据在 `data.dataList` |
| `/oapi/dispatch/v2/task/list` | POST | `sourceUuid`, `statusList`, `startTime`, `endTime`, `cursorId`, `cursorDirection`, `size` | 10/s | `/api/yingdao/task/executions` | 任务抽屉历史执行、调试页 | `sourceUuid` 一般等于 `scheduleUuid` |
| `/oapi/dispatch/v2/task/process/detail` | POST | `taskUuid`, `robotClientUuid` | 10/s | `/api/yingdao/task/process-detail` | 任务抽屉应用运行明细、调试页 | `taskUuid` 必须来自执行记录 |
| `/oapi/dispatch/v2/job/list` | POST | `robotClientUuid`, `cursorId`, `cursorDirection`, `size` | 10/s | `/api/yingdao/robot/jobs` | 机器表格当前任务/状态、机器抽屉、调试页 | 机器任务队列真值来源 |
| `/oapi/dispatch/v2/task/query` | POST | `taskUuid` | 10/s | `/api/yingdao/task/query` | 调试/后续操作 | 运行态任务查询 |
| `/oapi/dispatch/v2/task/start` | POST | `scheduleUuid`, `scheduleRelaParams` | 10/s | `/api/yingdao/task/start` | 后续操作入口 | 启动任务 |
| `/oapi/dispatch/v2/task/stop` | POST | `taskUuid` | 10/s | `/api/yingdao/task/stop` | 后续操作入口 | 停止运行态任务 |
| `/oapi/dispatch/v2/task/retry` | POST | `taskUuid` | 10/s | `/api/yingdao/task/retry` | 后续操作入口 | 重试运行态任务 |
| `/oapi/dispatch/v2/job/log/search` | POST | `jobUuid`, `page`, `size`, `queryFilter` | 5/s | `/api/yingdao/job/logs/search` | `DebugView` | 先拿 `requestId` |
| `/oapi/dispatch/v2/job/log/query` | GET | `requestId` | 5/s | `/api/yingdao/job/logs/query` | `DebugView` | `80204002` 需要继续轮询 |

## 当前页面数据口径

### 机器视图
- 主实体: `client/list`
- 详情补充: `client/query`
- 当前任务/当前状态/队列: `job/list`
- 关联任务/应用: `schedule/detail` 解析结果

### 任务视图
- 主实体: `schedule/list`
- 关联应用/机器: `schedule/detail`
- 最近执行结果: `task/newest/list`
- 历史执行: `task/list`
- 应用运行明细: `task/process/detail`

### 应用视图
- 主实体: `app/open/query/list`
- 关联任务/机器: 由 `schedule/detail` 反向聚合
- 最近调用/最近状态: `app/open/query/use/record/list`

### 时间视图
- 未来计划: `schedule/list` + `schedule/detail`
- 历史执行: `task/newest/list` + `task/list`
- 历史失败: 基于明确失败状态集合判定

## 调试约定

前端/后端统一结构化日志前缀：
- `[api-request]`: 请求及失败信息
- `[api-rate-limit]`: 限流/401 重试
- `[association]`: 任务与应用/机器关联映射
- `[robot-jobs]`: 机器人任务队列
- `[app-runs]`: 应用运行记录

## 常见误区

1. `schedule/detail` 不要传 `taskUuid`。
2. `task/list` 不要传 `taskUuid`，要传 `sourceUuid`。
3. `task/process/detail` 不能直接拿 `scheduleUuid`，必须拿执行记录里的真实 `taskUuid`。
4. `client/list` 默认不要固定 `status=idle`，否则机器视图会漏数据。
5. `appId` 和 `robotUuid` 不要混为一谈；当前项目只把 `robotUuid` 保留为兼容映射字段。
