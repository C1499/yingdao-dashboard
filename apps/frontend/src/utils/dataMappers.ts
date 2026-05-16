import type {
  AppEntity,
  AppRunRecordEntity,
  AppViewRow,
  DrawerSection,
  ExecutionEntity,
  MachineViewRow,
  MainViewKey,
  RobotEntity,
  RobotJobEntity,
  SummaryCardItem,
  TaskDetailEntity,
  TaskEntity,
  TaskViewRow,
  TimelineItem,
  ViewDataBundle,
} from '../types';

function normalizeText(value: unknown, fallback = '无') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function parseTime(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatTime(value?: string, fallback = '无') {
  if (!value) return fallback;
  const time = parseTime(value);
  if (time === null) return value;
  return new Date(time).toLocaleString('zh-CN', { hour12: false });
}

function getTaskNextTime(task?: TaskEntity) {
  return task?.nextFireTime || task?.cronInterface?.nextTime;
}

function getTaskCronExpression(task?: TaskEntity) {
  return task?.cronExpression || task?.cronInterface?.cronExpress;
}

function getTaskType(task?: TaskEntity) {
  return task?.scheduleType || task?.type || task?.cronInterface?.type;
}

function padTime(value?: number) {
  return String(value ?? 0).padStart(2, '0');
}

function parseCronNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function describeCronList(field: string, unit: 'hour' | 'minute') {
  const values = field
    .split(',')
    .map((item) => parseCronNumber(item))
    .filter((item): item is number => item !== null)
    .sort((a, b) => a - b);

  if (!values.length) return '';
  if (unit === 'hour') return values.map((item) => `${padTime(item)}:00`).join(' / ');
  return values.map((item) => `${padTime(item)}分`).join(' / ');
}

function describeWeekday(field: string) {
  const names: Record<string, string> = {
    '0': '周日',
    '1': '周一',
    '2': '周二',
    '3': '周三',
    '4': '周四',
    '5': '周五',
    '6': '周六',
    '7': '周日',
  };

  if (field === '*') return '每天';
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    return `每${names[start] || start}至${names[end] || end}`;
  }
  return `每${field.split(',').map((item) => names[item] || item).join('/')}`;
}

function describeCronExpression(expression?: string) {
  if (!expression) return '';
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return '';

  const [minute, hour, dayOfMonth, month, weekday] = parts;
  const minuteNumber = parseCronNumber(minute);

  if (minuteNumber === null && minute !== '*') return '';

  if (dayOfMonth !== '*' && month === '*' && weekday === '*') {
    const day = parseCronNumber(dayOfMonth);
    if (day !== null && hour !== '*') {
      const hourText = describeCronList(hour, 'hour');
      return `每月 ${day} 日 ${hourText.replace(/:00/g, `:${padTime(minuteNumber || 0)}`)} 调用`;
    }
  }

  if (weekday !== '*' && dayOfMonth === '*') {
    const weekdayText = describeWeekday(weekday);
    const hourText = describeCronList(hour, 'hour').replace(/:00/g, `:${padTime(minuteNumber || 0)}`);
    if (hourText) return `${weekdayText} ${hourText} 调用`;
  }

  if (hour.includes('/')) {
    const [startRaw, stepRaw] = hour.split('/');
    const start = parseCronNumber(startRaw);
    const step = parseCronNumber(stepRaw);
    if (start !== null && step !== null) {
      return `每天从 ${padTime(start)}:${padTime(minuteNumber || 0)} 开始，每 ${step} 小时调用`;
    }
  }

  if (hour.includes(',')) {
    const hourText = describeCronList(hour, 'hour').replace(/:00/g, `:${padTime(minuteNumber || 0)}`);
    if (hourText) return `每天 ${hourText} 调用`;
  }

  if (hour !== '*' && dayOfMonth === '*' && month === '*' && weekday === '*') {
    const hourNumber = parseCronNumber(hour);
    if (hourNumber !== null) return `每天 ${padTime(hourNumber)}:${padTime(minuteNumber || 0)} 调用`;
  }

  if (hour === '*' && minuteNumber !== null) {
    return `每小时第 ${padTime(minuteNumber)} 分钟调用`;
  }

  return '';
}

function getTaskScheduleSummary(task?: TaskEntity) {
  if (!task) return '无调度信息';
  const cron = task.cronInterface || {};
  const nextTime = formatTime(getTaskNextTime(task));
  const type = cron.type || getTaskType(task);

  if (Array.isArray(cron.dayOfWeeks) && cron.dayOfWeeks.length && (cron.hour !== undefined || cron.minute !== undefined)) {
    return `每周 ${cron.dayOfWeeks.join('/')} ${padTime(cron.hour)}:${padTime(cron.minute)} 调用，下一次 ${nextTime}`;
  }

  if (type === 'day' && (cron.hour !== undefined || cron.minute !== undefined)) {
    return `每天 ${padTime(cron.hour)}:${padTime(cron.minute)} 调用，下一次 ${nextTime}`;
  }

  if (type === 'minute' && cron.minute !== undefined) {
    return `每 ${cron.minute} 分钟调用，下一次 ${nextTime}`;
  }

  if (type === 'cron' && cron.cronExpress) {
    const cronText = describeCronExpression(cron.cronExpress);
    return `${cronText || `Cron ${cron.cronExpress}`}，下一次 ${nextTime}`;
  }

  if (nextTime !== '无') {
    return `下一次 ${nextTime}`;
  }

  return normalizeText(getTaskCronExpression(task), '无调度信息');
}

function taskWithSchedule(task: TaskEntity) {
  return `${task.scheduleName} · ${getTaskScheduleSummary(task)}`;
}

function appWithSchedule(app: AppEntity, tasks: TaskEntity[]) {
  const nextTask = sortByTimeAsc(tasks, (task) => getTaskNextTime(task))[0];
  return `${normalizeText(app.robotName || app.appName)} · ${nextTask ? getTaskScheduleSummary(nextTask) : '无调度信息'}`;
}

function isToday(value?: string) {
  const time = parseTime(value);
  if (time === null) return false;
  const target = new Date(time);
  const now = new Date();
  return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
}

function isWithinHours(value?: string, hours = 24) {
  const time = parseTime(value);
  if (time === null) return false;
  const now = Date.now();
  return time >= now && time <= now + hours * 60 * 60 * 1000;
}

function isWithinDays(value?: string, days = 7) {
  const time = parseTime(value);
  if (time === null) return false;
  const now = Date.now();
  return time >= now && time <= now + days * 24 * 60 * 60 * 1000;
}

function extractData<T>(obj: T | { data?: T; error?: unknown } | null | undefined): T | null {
  if (!obj || (obj as any).error) return null;
  return ((obj as any).data || obj) as T;
}

function translateMachineStatus(status?: string) {
  const normalized = normalizeText(status, 'unknown').toLowerCase();
  const statusMap: Record<string, string> = {
    idle: '空闲',
    online: '在线',
    offline: '离线',
    running: '运行中',
    waiting: '等待中',
    waiting_dispatch: '等待调度',
    error: '异常',
    fail: '失败',
    failed: '失败',
    finish: '完成',
    success: '完成',
    stopped: '已停止',
    stop: '已停止',
    cancel: '已取消',
    cancelled: '已取消',
    terminate: '已终止',
    unknown: '未知',
  };

  return statusMap[normalized] || normalizeText(status, '未知');
}

function translateExecutionStatus(status?: string) {
  const normalized = normalizeText(status, 'unknown').toLowerCase();
  const statusMap: Record<string, string> = {
    running: '执行中',
    run: '执行中',
    waiting: '等待中',
    waiting_dispatch: '等待调度',
    finish: '完成',
    success: '完成',
    fail: '失败',
    failed: '失败',
    error: '异常',
    stopped: '已停止',
    stop: '已停止',
    cancel: '已取消',
    cancelled: '已取消',
    terminate: '已终止',
    offline: '离线',
    idle: '空闲',
    online: '在线',
    unknown: '未知',
  };

  return statusMap[normalized] || normalizeText(status, '未知');
}

function getExecutionStatus(execution?: ExecutionEntity) {
  const raw = normalizeText(execution?.statusName || execution?.status || execution?.result, '未知');
  return translateExecutionStatus(raw);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '无';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

function getExecutionDuration(execution?: ExecutionEntity) {
  if (!execution) return '无';

  const start = parseTime(execution.startTime || execution.executeTime || execution.createTime);
  const end = parseTime(execution.endTime || execution.updateTime);
  if (start !== null && end !== null && end >= start) {
    return formatDuration(end - start);
  }

  const fallbackSeconds = Number((execution as any).runningTime || (execution as any).durationSeconds || 0);
  if (Number.isFinite(fallbackSeconds) && fallbackSeconds > 0) {
    return formatDuration(fallbackSeconds * 1000);
  }

  return '无';
}

function getAppRunRecordDuration(record?: AppRunRecordEntity) {
  if (!record) return '无';

  const start = parseTime(record.startTime);
  const end = parseTime(record.endTime || record.updateTime);
  if (start !== null && end !== null && end >= start) {
    return formatDuration(end - start);
  }

  const runningTimeSeconds = Number(record.runningTime || 0);
  if (Number.isFinite(runningTimeSeconds) && runningTimeSeconds > 0) {
    return formatDuration(runningTimeSeconds * 1000);
  }

  return '无';
}

function isFailureStatus(status?: string) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ['fail', 'failed', 'error', 'exception', 'abnormal', 'stop', '异常', '失败', '已停止'].some((token) => normalized.includes(token));
}

function isRunningStatus(status?: string) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ['run', 'running', 'executing', 'processing', '执行', '等待'].some((token) => normalized.includes(token));
}

function sortByTimeDesc<T>(list: T[], selector: (item: T) => string | undefined) {
  return [...list].sort((a, b) => (parseTime(selector(b)) || 0) - (parseTime(selector(a)) || 0));
}

function sortByTimeAsc<T>(list: T[], selector: (item: T) => string | undefined) {
  return [...list].sort((a, b) => (parseTime(selector(a)) || Number.MAX_SAFE_INTEGER) - (parseTime(selector(b)) || Number.MAX_SAFE_INTEGER));
}

function findLatestExecution(executions: ExecutionEntity[]) {
  return sortByTimeDesc(executions, (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime)[0];
}

function findLatestFailure(executions: ExecutionEntity[]) {
  return sortByTimeDesc(
    executions.filter((item) => isFailureStatus(getExecutionStatus(item))),
    (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime,
  )[0];
}

function findCurrentExecution(executions: ExecutionEntity[]) {
  return sortByTimeDesc(
    executions.filter((item) => isRunningStatus(getExecutionStatus(item))),
    (item) => item.startTime || item.executeTime || item.updateTime || item.endTime || item.createTime,
  )[0];
}

function joinUnique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function getExecutionMachineNames(execution: ExecutionEntity, mappedRobots: RobotEntity[]) {
  const mappedNames = mappedRobots.map((robot) => normalizeText(robot.machineName || robot.robotClientName || robot.robotName));
  if (mappedNames.length > 0) return joinUnique(mappedNames);

  const fallbackNames = [
    normalizeText((execution as any).machineName, ''),
    normalizeText(execution.robotClientName, ''),
  ].filter(Boolean);

  return joinUnique(fallbackNames);
}

function extractAppUuidsFromTaskDetail(taskData: TaskDetailEntity) {
  const directRefs = [
    ...(taskData.robotList || []),
    ...(taskData.robots || []),
    ...((taskData as any).scheduleRelaParams || []),
    ...((taskData as any).scheduleRelaParamList || []),
  ];

  return joinUnique(
    directRefs
      .map((item: any) => item?.robotUuid || item?.uuid)
      .filter(Boolean),
  );
}

function makeTimeline(executions: ExecutionEntity[]) {
  return sortByTimeDesc(executions, (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime)
    .slice(0, 8)
    .map((execution) => ({
      title: `${normalizeText(execution.taskName || execution.scheduleUuid, '任务')} · ${getExecutionStatus(execution)}`,
      meta: formatTime(execution.endTime || execution.updateTime || execution.executeTime || execution.startTime || execution.createTime),
      tone: (isFailureStatus(getExecutionStatus(execution)) ? 'danger' : isRunningStatus(getExecutionStatus(execution)) ? 'warning' : 'success') as
        | 'success'
        | 'warning'
        | 'danger',
    }));
}

export function buildDashboardData(
  apps: AppEntity[],
  appRunRecords: AppRunRecordEntity[],
  tasks: TaskEntity[],
  robots: RobotEntity[],
  taskDetails: TaskDetailEntity[],
  executionMap: Record<string, ExecutionEntity[]>,
  robotJobMap: Record<string, RobotJobEntity[]> = {},
): ViewDataBundle {
  const appByUuid = new Map(apps.map((item) => [item.robotUuid, item]));
  const robotByUuid = new Map(robots.map((item) => [item.robotClientUuid || item.uuid || '', item]));
  const taskByUuid = new Map(tasks.map((item) => [item.scheduleUuid, item]));
  const appRunRecordMap = new Map<string, AppRunRecordEntity[]>();

  appRunRecords.forEach((record) => {
    const appUuid = record.appId;
    if (!appUuid) return;
    appRunRecordMap.set(appUuid, [...(appRunRecordMap.get(appUuid) || []), record]);
  });

  const appTasksMap = new Map<string, TaskEntity[]>();
  const robotTasksMap = new Map<string, TaskEntity[]>();
  const taskAppsMap = new Map<string, AppEntity[]>();
  const taskRobotsMap = new Map<string, RobotEntity[]>();
  const taskDetailMap = new Map<string, TaskDetailEntity>();
  const taskPlannedAppsMap = new Map<string, AppEntity[]>();
  const taskPlannedRobotsMap = new Map<string, RobotEntity[]>();

  function appendUniqueApp(scheduleUuid: string, task: TaskEntity, app?: AppEntity | null) {
    if (!app) return;
    const appUuid = app.robotUuid || app.appId;
    if (!appUuid) return;
    const currentApps = taskAppsMap.get(scheduleUuid) || [];
    if (!currentApps.some((item) => (item.robotUuid || item.appId) === appUuid)) {
      taskAppsMap.set(scheduleUuid, [...currentApps, app]);
    }
    const currentTasks = appTasksMap.get(appUuid) || [];
    if (!currentTasks.some((item) => item.scheduleUuid === task.scheduleUuid)) {
      appTasksMap.set(appUuid, [...currentTasks, task]);
    }
  }

  function appendUniqueRobot(scheduleUuid: string, task: TaskEntity, robot?: RobotEntity | null) {
    if (!robot?.robotClientUuid) return;
    const currentRobots = taskRobotsMap.get(scheduleUuid) || [];
    if (!currentRobots.some((item) => item.robotClientUuid === robot.robotClientUuid)) {
      taskRobotsMap.set(scheduleUuid, [...currentRobots, robot]);
    }
    const currentTasks = robotTasksMap.get(robot.robotClientUuid) || [];
    if (!currentTasks.some((item) => item.scheduleUuid === task.scheduleUuid)) {
      robotTasksMap.set(robot.robotClientUuid, [...currentTasks, task]);
    }
  }

  function extractRobotClientUuidsFromTaskDetail(taskData: TaskDetailEntity) {
    return joinUnique(
      [
        ...(taskData.robotClientList || []),
        ...(taskData.clients || []),
      ]
        .map((item: any) => item?.uuid || item?.robotClientUuid || item?.clientUuid)
        .filter(Boolean),
    );
  }

  taskDetails.forEach((detail) => {
    const taskData = extractData<TaskDetailEntity>(detail);
    if (!taskData) return;
    const scheduleUuid = taskData.scheduleUuid || taskData.taskUuid || taskData.uuid;
    if (!scheduleUuid) return;
    const task = taskByUuid.get(scheduleUuid);
    if (!task) return;

    taskDetailMap.set(scheduleUuid, taskData);

    const taskApps = extractAppUuidsFromTaskDetail(taskData)
      .map((appUuid) => appByUuid.get(appUuid))
      .filter(Boolean) as AppEntity[];
    if (taskApps.length > 0) {
      taskPlannedAppsMap.set(scheduleUuid, taskApps);
      taskApps.forEach((app) => appendUniqueApp(scheduleUuid, task, app));
    }

    const taskRobots = extractRobotClientUuidsFromTaskDetail(taskData)
      .map((robotUuid) => robotByUuid.get(robotUuid))
      .filter(Boolean) as RobotEntity[];
    if (taskRobots.length > 0) {
      taskPlannedRobotsMap.set(scheduleUuid, taskRobots);
      taskRobots.forEach((robot) => appendUniqueRobot(scheduleUuid, task, robot));
    }

    console.log('[association]', {
      task: task.scheduleName,
      scheduleUuid,
      appNames: taskApps.map((app) => app.robotName),
      appUuids: taskApps.map((app) => app.robotUuid),
      robotNames: taskRobots.map((robot) => normalizeText(robot.machineName || robot.robotClientName || robot.robotName)),
      robotClientUuids: taskRobots.map((robot) => robot.robotClientUuid),
      detailKeys: Object.keys(taskData),
    });
  });

  tasks.forEach((task) => {
    const executions = executionMap[task.scheduleUuid] || [];
    executions.forEach((execution) => {
      const executionRobotUuid = execution.robotClientUuid;

      if (executionRobotUuid) {
        const existingRobot = robotByUuid.get(executionRobotUuid);
        appendUniqueRobot(task.scheduleUuid, task, existingRobot || {
          robotClientUuid: executionRobotUuid,
          robotClientName: normalizeText(execution.robotClientName, executionRobotUuid),
          status: normalizeText(execution.robotClientStatus, 'unknown'),
          clientIp: execution.clientIp,
          machineName: (execution as any).machineName,
        });
      }
    });
  });

  const machineRows: MachineViewRow[] = robots.map((robot) => {
    const relatedTasks = robotTasksMap.get(robot.robotClientUuid) || [];
    const relatedApps = joinUnique(
      relatedTasks
        .flatMap((task) => (taskAppsMap.get(task.scheduleUuid) || []).map((app) => app.robotUuid))
        .filter(Boolean) as string[],
    ).map((appUuid) => appByUuid.get(appUuid)).filter(Boolean) as AppEntity[];
    const relatedExecutions = sortByTimeDesc(
      relatedTasks.flatMap((task) => (executionMap[task.scheduleUuid] || []).map((execution) => ({ ...execution, taskName: task.scheduleName }))),
      (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime,
    );
    const currentExecution = findCurrentExecution(relatedExecutions);
    const latestExecution = findLatestExecution(relatedExecutions);
    const latestFailure = findLatestFailure(relatedExecutions);
    const nextTask = sortByTimeAsc(relatedTasks, (task) => task.nextFireTime)[0];
    const jobs = sortByTimeDesc(robotJobMap[robot.robotClientUuid] || [], (item) => item.startTime || item.triggerTime || item.endTime);
    const currentJob = jobs.find((job) => isRunningStatus(job.status) || (job.status || '').toLowerCase().includes('wait'));
    const latestJobFailure = jobs.find((job) => isFailureStatus(job.status) || isFailureStatus(job.remark));
    const latestJob = jobs[0];

    return {
      id: robot.robotClientUuid,
      machineName: normalizeText(robot.machineName || robot.robotClientName || robot.robotName),
      robotClientName: normalizeText(robot.robotClientName || robot.accountName),
      onlineStatus: translateMachineStatus(robot.status),
      currentStatus:
        currentJob?.statusName || currentJob?.status
          ? translateExecutionStatus(currentJob?.statusName || currentJob?.status)
          : (currentExecution ? '执行中' : robot.status === 'idle' ? '空闲' : translateMachineStatus(robot.status)),
      currentTask: currentJob?.taskName || currentExecution?.taskName || latestJob?.taskName || nextTask?.scheduleName || '无',
      todayPendingCount: relatedTasks.filter((task) => isToday(getTaskNextTime(task))).length,
      nextExecutionTime: formatTime(getTaskNextTime(nextTask)),
      latestFailure:
        latestJobFailure?.remark ||
        latestFailure?.errorMessage ||
        latestFailure?.message ||
        getExecutionStatus(latestFailure) ||
        '无',
      relatedTaskCount: relatedTasks.length,
      relatedAppCount: relatedApps.length,
      relatedTaskNames: joinUnique(relatedTasks.map((task) => task.scheduleName)),
      relatedAppNames: joinUnique(relatedApps.map((app) => app.robotName)),
      latestExecutionStatus: getExecutionStatus(latestExecution),
      latestExecutionTime: formatTime(latestExecution?.endTime || latestExecution?.updateTime || latestExecution?.executeTime || latestExecution?.startTime || latestExecution?.createTime),
      latestExecutionDuration: getExecutionDuration(latestExecution),
      robot,
      tasks: relatedTasks,
      apps: relatedApps,
      executions: relatedExecutions,
    };
  });

  const taskRows: TaskViewRow[] = tasks.map((task) => {
    const taskApps = taskAppsMap.get(task.scheduleUuid) || [];
    const plannedApps = taskPlannedAppsMap.get(task.scheduleUuid) || [];
    const app = taskApps[0];
    const taskRobots = taskRobotsMap.get(task.scheduleUuid) || [];
    const plannedRobots = taskPlannedRobotsMap.get(task.scheduleUuid) || [];
    const robot = taskRobots[0];
    const executions = sortByTimeDesc(
      (executionMap[task.scheduleUuid] || []).map((execution) => ({ ...execution, taskName: task.scheduleName })),
      (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime,
    );
    const latestExecution = findLatestExecution(executions);
    const currentExecution = findCurrentExecution(executions);

    return {
      id: task.scheduleUuid,
      scheduleUuid: task.scheduleUuid,
      scheduleName: normalizeText(task.scheduleName),
      enabledLabel: task.enabled ? '启用' : '禁用',
      type: normalizeText(getTaskType(task), '未知'),
      appName: taskApps.length ? taskApps.map((item) => item.robotName).join(' / ') : '无',
      appUuid: app?.robotUuid || '',
      appUuids: taskApps.map((item) => item.robotUuid),
      robotName: taskRobots.length ? taskRobots.map((item) => normalizeText(item.machineName || item.robotClientName || item.robotName)).join(' / ') : '无',
      robotClientUuid: robot?.robotClientUuid || '',
      robotClientUuids: taskRobots.map((item) => item.robotClientUuid),
      nextExecutionTime: formatTime(getTaskNextTime(task)),
      latestExecutionResult: getExecutionStatus(latestExecution),
      latestExecutionTime: formatTime(latestExecution?.endTime || latestExecution?.updateTime || latestExecution?.executeTime || latestExecution?.startTime || latestExecution?.createTime),
      latestExecutionDuration: getExecutionDuration(latestExecution),
      currentStatus: currentExecution ? '执行中' : task.enabled ? '待调度' : '已停用',
      cronExpression: normalizeText(getTaskCronExpression(task)),
      relatedAppNames: taskApps.map((item) => item.robotName),
      relatedRobotNames: taskRobots.map((item) => normalizeText(item.machineName || item.robotClientName || item.robotName)),
      plannedAppNames: plannedApps.map((item) => normalizeText(item.robotName || item.appName)),
      plannedRobotNames: plannedRobots.map((item) => normalizeText(item.machineName || item.robotClientName || item.robotName)),
      task,
      app,
      apps: taskApps,
      robot,
      robots: taskRobots,
      detail: taskDetailMap.get(task.scheduleUuid),
      executions,
    };
  });

  const appRows: AppViewRow[] = apps.map((app) => {
    const relatedTasks = appTasksMap.get(app.robotUuid) || [];
    const relatedRobots = joinUnique(
      relatedTasks
        .flatMap((task) => (taskRobotsMap.get(task.scheduleUuid) || []).map((robot) => robot.robotClientUuid))
        .filter(Boolean) as string[],
    ).map((robotUuid) => robotByUuid.get(robotUuid)).filter(Boolean) as RobotEntity[];
    const relatedExecutions = sortByTimeDesc(
      relatedTasks.flatMap((task) => (executionMap[task.scheduleUuid] || []).map((execution) => ({ ...execution, taskName: task.scheduleName }))),
      (item) => item.endTime || item.updateTime || item.executeTime || item.startTime || item.createTime,
    );
    const latestExecution = findLatestExecution(relatedExecutions);
    const nextTask = sortByTimeAsc(relatedTasks, (task) => getTaskNextTime(task))[0];
    const runRecords = sortByTimeDesc(appRunRecordMap.get(app.appId || app.robotUuid) || [], (record) => record.endTime || record.startTime || record.updateTime);
    const latestAppRun = runRecords[0];

    return {
      id: app.appId || app.robotUuid,
      appId: app.appId || app.robotUuid,
      robotUuid: app.robotUuid,
      appName: normalizeText(app.robotName || app.appName),
      description: normalizeText(app.description),
      relatedTaskCount: relatedTasks.length,
      relatedMachineCount: relatedRobots.length,
      latestExecutionTime: formatTime(latestAppRun?.endTime || latestAppRun?.startTime || latestExecution?.endTime || latestExecution?.updateTime || latestExecution?.executeTime || latestExecution?.startTime || latestExecution?.createTime),
      latestExecutionDuration: latestAppRun ? getAppRunRecordDuration(latestAppRun) : getExecutionDuration(latestExecution),
      nextExecutionTime: formatTime(getTaskNextTime(nextTask)),
      latestStatus: normalizeText(latestAppRun?.runStatusName || latestAppRun?.runStatus || getExecutionStatus(latestExecution), '无'),
      relatedTaskNames: joinUnique(relatedTasks.map((task) => task.scheduleName)),
      relatedMachineNames: joinUnique(relatedRobots.map((robot) => normalizeText(robot.machineName || robot.robotClientName || robot.robotName))),
      app,
      tasks: relatedTasks,
      robots: relatedRobots,
      executions: relatedExecutions,
      runRecords,
    };
  });

  const timeline: TimelineItem[] = [
    ...tasks
      .filter((task) => getTaskNextTime(task))
      .map((task) => {
        const machineNames = (taskRobotsMap.get(task.scheduleUuid) || []).map((robot) => normalizeText(robot.machineName || robot.robotClientName || robot.robotName));
        return {
        id: `future-${task.scheduleUuid}`,
        taskName: normalizeText(task.scheduleName),
        taskUuid: task.scheduleUuid,
        machineName: machineNames.join(' / ') || '无',
        machineNames,
        appName: (taskAppsMap.get(task.scheduleUuid) || []).map((app) => app.robotName).join(' / ') || '无',
        scheduledTime: formatTime(getTaskNextTime(task)),
        executionTime: '未执行',
        executionDuration: '--',
        status: '待执行',
        result: '计划中',
        type: 'future' as const,
        logAvailable: false,
        raw: task,
      }}),
    ...tasks.flatMap((task) =>
      (executionMap[task.scheduleUuid] || []).map((execution, index) => {
        const taskRobots = taskRobotsMap.get(task.scheduleUuid) || [];
        const machineNames = getExecutionMachineNames(execution, taskRobots);
        const mappedAppNames = (taskAppsMap.get(task.scheduleUuid) || []).map((app) => app.robotName);
        return {
        id: `history-${task.scheduleUuid}-${index}`,
        taskName: normalizeText(task.scheduleName),
        taskUuid: task.scheduleUuid,
        machineName: machineNames.join(' / ') || '无',
        machineNames,
        appName: mappedAppNames.join(' / ') || '无关联应用',
        scheduledTime: formatTime(getTaskNextTime(task)),
        executionTime: formatTime(execution.endTime || execution.updateTime || execution.executeTime || execution.startTime || execution.createTime),
        executionDuration: getExecutionDuration(execution),
        status: getExecutionStatus(execution),
        result: execution.errorMessage || execution.message || getExecutionStatus(execution),
        type: 'history' as const,
        jobUuid: (execution as any).jobUuid,
        robotClientUuid: execution.robotClientUuid,
        logAvailable: Boolean((execution as any).jobUuid || (execution.taskUuid && execution.robotClientUuid)),
        raw: execution,
      }})),
  ].sort((a, b) => {
    const timeA = parseTime(a.type === 'future' ? getTaskNextTime(a.raw as TaskEntity) : (a.raw as ExecutionEntity)?.endTime || (a.raw as ExecutionEntity)?.updateTime || (a.raw as ExecutionEntity)?.executeTime || (a.raw as ExecutionEntity)?.startTime || (a.raw as ExecutionEntity)?.createTime) || 0;
    const timeB = parseTime(b.type === 'future' ? getTaskNextTime(b.raw as TaskEntity) : (b.raw as ExecutionEntity)?.endTime || (b.raw as ExecutionEntity)?.updateTime || (b.raw as ExecutionEntity)?.executeTime || (b.raw as ExecutionEntity)?.startTime || (b.raw as ExecutionEntity)?.createTime) || 0;
    return timeB - timeA;
  });

  const summary: Record<MainViewKey, SummaryCardItem[]> = {
    machines: [
      { key: 'online-machines', label: '在线机器', value: machineRows.filter((item) => item.onlineStatus === '空闲' || item.onlineStatus === '在线' || item.onlineStatus === '运行中').length, tone: 'success' },
      { key: 'anomaly-machines', label: '异常机器', value: machineRows.filter((item) => item.latestFailure !== '无' || item.onlineStatus === '离线').length, tone: 'danger' },
      { key: 'today-pending', label: '今日待执行', value: machineRows.reduce((sum, item) => sum + item.todayPendingCount, 0), tone: 'warning' },
      { key: 'next-24h', label: '未来24小时计划', value: tasks.filter((task) => isWithinHours(getTaskNextTime(task), 24)).length },
    ],
    tasks: [
      { key: 'enabled-tasks', label: '启用任务', value: tasks.filter((item) => item.enabled).length, tone: 'success' },
      { key: 'failing-tasks', label: '最近失败任务', value: taskRows.filter((item) => isFailureStatus(item.latestExecutionResult)).length, tone: 'danger' },
      { key: 'linked-apps', label: '覆盖应用', value: new Set(taskRows.flatMap((item) => item.appUuids)).size },
      { key: 'scheduled-soon', label: '24小时内执行', value: tasks.filter((task) => isWithinHours(getTaskNextTime(task), 24)).length, tone: 'warning' },
    ],
    apps: [
      { key: 'active-apps', label: '应用总数', value: apps.length },
      { key: 'linked-machines', label: '覆盖机器', value: new Set(appRows.flatMap((item) => item.robots.map((robot) => robot.robotClientUuid))).size, tone: 'success' },
      { key: 'recent-failures', label: '最近异常应用', value: appRows.filter((item) => isFailureStatus(item.latestStatus)).length, tone: 'danger' },
      { key: 'planned-calls', label: '待调用计划', value: appRows.filter((item) => item.nextExecutionTime !== '无').length, tone: 'warning' },
    ],
    timeline: [
      { key: 'today-window', label: '今日待执行', value: tasks.filter((task) => isToday(getTaskNextTime(task))).length, tone: 'warning' },
      { key: 'future-window', label: '未来24小时', value: tasks.filter((task) => isWithinHours(getTaskNextTime(task), 24)).length },
      { key: 'week-window', label: '本周计划', value: tasks.filter((task) => isWithinDays(getTaskNextTime(task), 7)).length },
      { key: 'history-window', label: '历史执行', value: timeline.filter((item) => item.type === 'history').length, tone: 'success' },
      { key: 'failed-window', label: '历史失败', value: timeline.filter((item) => item.type === 'history' && isFailureStatus(item.status)).length, tone: 'danger' },
    ],
  };

  const drawerSections: Record<string, DrawerSection[]> = {};

  machineRows.forEach((item) => {
    drawerSections[`machines:${item.id}`] = [
      {
        title: '基础信息',
        fields: [
          { label: '机器名称', value: item.machineName },
          { label: '在线状态', value: item.onlineStatus },
          { label: '当前状态', value: item.currentStatus },
          { label: '当前任务', value: item.currentTask },
          { label: '下次执行', value: item.nextExecutionTime },
          { label: '最近执行', value: item.latestExecutionTime },
          { label: '最近运行时长', value: item.latestExecutionDuration },
        ],
      },
      { title: '关联任务', list: item.tasks.length ? item.tasks.map(taskWithSchedule) : ['无关联任务'] },
      { title: '关联应用', list: item.apps.length ? item.apps.map((app) => appWithSchedule(app, item.tasks.filter((task) => (taskAppsMap.get(task.scheduleUuid) || []).some((taskApp) => (taskApp.robotUuid || taskApp.appId) === (app.robotUuid || app.appId))))) : ['无关联应用'] },
      { title: '最近执行记录', timeline: makeTimeline(item.executions) },
    ];
  });

  taskRows.forEach((item) => {
    drawerSections[`tasks:${item.id}`] = [
      {
        title: '任务基础信息',
        fields: [
          { label: '任务名', value: item.scheduleName },
          { label: '状态', value: item.currentStatus },
          { label: '调度类型', value: item.type },
          { label: 'Cron表达式', value: item.cronExpression },
          { label: '下次执行时间', value: item.nextExecutionTime },
          { label: '最近执行结果', value: item.latestExecutionResult },
          { label: '上次运行时长', value: item.latestExecutionDuration },
        ],
      },
      { title: '关联应用', list: item.apps.length ? item.apps.map((app) => `${normalizeText(app.robotName || app.appName)} · ${getTaskScheduleSummary(item.task)}`) : ['无关联应用'] },
      { title: '关联机器', list: item.relatedRobotNames.length ? item.relatedRobotNames : ['无关联机器'] },
      { title: '历史执行', timeline: makeTimeline(item.executions) },
    ];
  });

  appRows.forEach((item) => {
    drawerSections[`apps:${item.id}`] = [
      {
        title: '应用基础信息',
        fields: [
          { label: '应用名', value: item.appName },
          { label: '描述', value: item.description },
          { label: '关联任务数', value: item.relatedTaskCount },
          { label: '关联机器数', value: item.relatedMachineCount },
          { label: '最近调用', value: item.latestExecutionTime },
          { label: '最近运行时长', value: item.latestExecutionDuration },
          { label: '下次调用', value: item.nextExecutionTime },
          { label: '最近状态', value: item.latestStatus },
        ],
      },
      { title: '关联任务', list: item.tasks.length ? item.tasks.map(taskWithSchedule) : ['无关联任务'] },
      { title: '覆盖机器', list: item.relatedMachineNames.length ? item.relatedMachineNames : ['无覆盖机器'] },
      {
        title: '最近应用运行',
        timeline: item.runRecords.length
          ? item.runRecords.slice(0, 8).map((record) => ({
              title: `${normalizeText(record.appName || item.appName)} · ${normalizeText(record.runStatusName || record.runStatus, '未知状态')}`,
              meta: formatTime(record.endTime || record.startTime || record.updateTime),
              tone: isFailureStatus(record.runStatus || record.runStatusName) ? 'danger' : 'success',
            }))
          : [{ title: '暂无应用运行记录', meta: '未查询到应用运行明细', tone: 'default' }],
      },
      { title: '最近调度记录', timeline: makeTimeline(item.executions) },
    ];
  });

  return {
    machines: machineRows,
    tasks: taskRows,
    apps: appRows,
    timeline,
    summary,
    drawerSections,
    executionMap,
  };
}
