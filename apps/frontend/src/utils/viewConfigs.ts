import type { ColumnConfig, MainViewKey, ModuleItem } from '../types';

export const mainViewTabs: Array<{ key: MainViewKey; label: string }> = [
  { key: 'machines', label: '机器视图' },
  { key: 'tasks', label: '任务视图' },
  { key: 'apps', label: '应用视图' },
  { key: 'timeline', label: '时间视图' },
];

export const utilityTabs = [
  { key: 'settings', label: '凭证设置' },
  { key: 'debug', label: '调试中心' },
  { key: 'detailed-debug', label: '详细诊断' },
] as const;

export const defaultColumns: Record<MainViewKey, ColumnConfig[]> = {
  machines: [
    { key: 'machineName', label: '机器名称', visible: true, filterable: true, sortable: true },
    { key: 'onlineStatus', label: '在线状态', visible: true, filterable: true, sortable: true },
    { key: 'currentStatus', label: '当前状态', visible: true, filterable: true, sortable: true },
    { key: 'currentTask', label: '当前任务', visible: true, filterable: true, sortable: true },
    { key: 'relatedTaskNames', label: '关联任务', visible: true, filterable: true, sortable: false },
    { key: 'relatedAppNames', label: '关联应用', visible: true, filterable: true, sortable: false },
    { key: 'todayPendingCount', label: '今日待执行数', visible: true, filterable: false, sortable: true },
    { key: 'nextExecutionTime', label: '下次执行时间', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionTime', label: '最近执行时间', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionDuration', label: '最近运行时长', visible: true, filterable: true, sortable: true },
    { key: 'latestFailure', label: '最近失败/异常', visible: true, filterable: true, sortable: false },
    { key: 'relatedTaskCount', label: '关联任务数', visible: true, filterable: false, sortable: true },
    { key: 'relatedAppCount', label: '关联应用数', visible: true, filterable: false, sortable: true },
  ],
  tasks: [
    { key: 'scheduleName', label: '任务名', visible: true, filterable: true, sortable: true },
    { key: 'currentStatus', label: '状态', visible: true, filterable: true, sortable: true },
    { key: 'appName', label: '关联应用', visible: true, filterable: true, sortable: true },
    { key: 'robotName', label: '关联机器', visible: true, filterable: true, sortable: true },
    { key: 'relatedAppNames', label: '应用映射明细', visible: true, filterable: true, sortable: false },
    { key: 'relatedRobotNames', label: '机器映射明细', visible: true, filterable: true, sortable: false },
    { key: 'nextExecutionTime', label: '下次执行时间', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionResult', label: '最近执行结果', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionTime', label: '最近执行时间', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionDuration', label: '上次运行时长', visible: true, filterable: true, sortable: true },
    { key: 'cronExpression', label: 'Cron表达式', visible: false, filterable: true, sortable: false },
  ],
  apps: [
    { key: 'appName', label: '应用名', visible: true, filterable: true, sortable: true },
    { key: 'relatedTaskCount', label: '关联任务数', visible: true, filterable: false, sortable: true },
    { key: 'relatedTaskNames', label: '关联任务名称', visible: true, filterable: true, sortable: false },
    { key: 'relatedMachineCount', label: '关联机器数', visible: true, filterable: false, sortable: true },
    { key: 'relatedMachineNames', label: '关联机器名称', visible: true, filterable: true, sortable: false },
    { key: 'latestExecutionTime', label: '最近调用时间', visible: true, filterable: true, sortable: true },
    { key: 'latestExecutionDuration', label: '最近运行时长', visible: true, filterable: true, sortable: true },
    { key: 'nextExecutionTime', label: '下次调用时间', visible: true, filterable: true, sortable: true },
    { key: 'latestStatus', label: '最近状态', visible: true, filterable: true, sortable: true },
    { key: 'description', label: '描述', visible: true, filterable: true, sortable: false },
  ],
  timeline: [],
};

export const defaultModules: Record<MainViewKey, ModuleItem[]> = {
  machines: [
    { key: 'online-machines', title: '在线机器', description: '当前在线机器数量' },
    { key: 'anomaly-machines', title: '异常机器', description: '最近失败或离线的机器' },
    { key: 'today-pending', title: '今日待执行', description: '今日待执行的任务总数' },
    { key: 'next-24h', title: '未来24小时计划', description: '未来24小时的计划量' },
  ],
  tasks: [
    { key: 'enabled-tasks', title: '启用任务', description: '当前启用的任务数量' },
    { key: 'failing-tasks', title: '最近失败任务', description: '最近执行异常的任务' },
    { key: 'linked-apps', title: '覆盖应用', description: '当前任务覆盖的应用数量' },
    { key: 'scheduled-soon', title: '即将执行', description: '未来24小时即将执行任务' },
  ],
  apps: [
    { key: 'active-apps', title: '应用总数', description: '当前应用数量' },
    { key: 'linked-machines', title: '覆盖机器', description: '应用覆盖机器数' },
    { key: 'recent-failures', title: '最近异常', description: '最近状态异常的应用' },
    { key: 'planned-calls', title: '待调用计划', description: '未来计划调用数' },
  ],
  timeline: [
    { key: 'today-window', title: '今日待执行', description: '今日计划窗口' },
    { key: 'future-window', title: '未来24小时', description: '24小时内计划' },
    { key: 'week-window', title: '本周计划', description: '本周累计计划' },
    { key: 'history-window', title: '历史执行', description: '已有历史执行记录' },
    { key: 'failed-window', title: '历史失败', description: '失败/异常记录' },
  ],
};
