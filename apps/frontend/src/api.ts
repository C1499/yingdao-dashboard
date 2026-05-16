import axios from 'axios';
import type {
  AppEntity,
  AppRunRecordEntity,
  CredentialsPayload,
  DashboardBaseData,
  ExecutionEntity,
  JobLogSearchResult,
  RobotDetailEntity,
  RobotJobEntity,
  RobotEntity,
  TaskProcessDetailEntity,
  TaskDetailEntity,
  TaskEntity,
} from './types';

function resolveApiBaseUrl() {
  const desktopBase = typeof window !== 'undefined' ? (window as any).__YINGDAO_API_BASE__ : undefined;
  if (desktopBase) return desktopBase;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://127.0.0.1:3001/api/yingdao';
  }
  return '/api/yingdao';
}

const client = axios.create({ baseURL: resolveApiBaseUrl() });

export type { CredentialsPayload } from './types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function runWorker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index], index);
      await sleep(120);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

export function extractList<T>(response: any): T[] {
  if (Array.isArray(response)) return response as T[];
  if (Array.isArray(response?.data)) return response.data as T[];
  if (Array.isArray(response?.data?.dataList)) return response.data.dataList as T[];
  if (Array.isArray(response?.records)) return response.records as T[];
  if (Array.isArray(response?.rows)) return response.rows as T[];
  if (Array.isArray(response?.data?.records)) return response.data.records as T[];
  return [];
}

function normalizeExecutionRecords(records: ExecutionEntity[]): ExecutionEntity[] {
  return records.flatMap((execution) => {
    const clients = Array.isArray((execution as any).taskClients) ? (execution as any).taskClients : [];
    if (clients.length === 0) {
      return [execution];
    }

    return clients.map((clientItem: any) => ({
      ...execution,
      robotClientUuid: clientItem.robotClientUuid || execution.robotClientUuid,
      robotClientName: clientItem.robotClientName || execution.robotClientName,
      robotClientStatus: clientItem.robotClientStatus || clientItem.clientStatus || execution.robotClientStatus,
      statusName: execution.statusName || clientItem.clientStatusName,
      currentRobotUuid: clientItem.currentRobotUuid || execution.currentRobotUuid,
      currentRobotName: clientItem.currentRobotName || execution.currentRobotName,
      clientIp: clientItem.clientIp || execution.clientIp,
      machineName: clientItem.machineName || (execution as any).machineName,
      startTime: execution.startTime || clientItem.sceneInstStartTime,
      endTime: execution.endTime || clientItem.sceneInstEndTime,
      taskClient: clientItem,
    }));
  });
}

export async function getCredentials() {
  const response = await client.get('/credentials');
  return response.data;
}

export async function saveCredentials(payload: CredentialsPayload) {
  const response = await client.post('/credentials', payload);
  return response.data;
}

export async function fetchApps() {
  const response = await client.get('/apps');
  return response.data;
}

export async function fetchAppRunRecords(
  minId = 0,
  size = 100,
  beginDate?: string,
  endDate?: string,
  appId?: string,
): Promise<AppRunRecordEntity[]> {
  const response = await client.post('/apps/run-records', {
    minId,
    size,
    beginDate,
    endDate,
    appId,
  });
  return extractList<AppRunRecordEntity>(response.data);
}

export async function fetchTasks() {
  const response = await client.get('/tasks');
  return response.data;
}

export async function fetchRobots() {
  const response = await client.get('/robots');
  return response.data;
}

export async function fetchRobotDetail(accountName?: string, robotClientUuid?: string): Promise<RobotDetailEntity | null> {
  const response = await client.post('/robot/detail', { accountName, robotClientUuid });
  return response.data?.data || response.data || null;
}

export async function fetchToken() {
  const response = await client.post('/token');
  return response.data;
}

export async function fetchTaskDetail(scheduleUuid: string, robotClientUuid?: string) {
  const response = await client.post('/task/detail', {
    scheduleUuid,
    robotClientUuid,
  });
  return response.data;
}

export async function fetchAppParams(robotUuid: string) {
  const response = await client.post('/app/params', { robotUuid });
  return response.data;
}

export async function fetchTaskExecutions(sourceUuid: string) {
  const response = await client.post('/task/executions', {
    sourceUuid,
  });
  return response.data;
}

export async function fetchTaskExecutionsBySchedule(sourceUuid: string): Promise<ExecutionEntity[]> {
  const response = await fetchTaskExecutions(sourceUuid);
  return normalizeExecutionRecords(extractList<ExecutionEntity>(response));
}

export async function fetchNewestTaskExecutions(
  page = 1,
  size = 100,
  statusList?: string[],
  startTime?: string,
  endTime?: string,
): Promise<ExecutionEntity[]> {
  const response = await client.post('/tasks/newest', {
    page,
    size,
    statusList,
    startTime,
    endTime,
  });
  return normalizeExecutionRecords(extractList<ExecutionEntity>(response.data));
}

export async function fetchTaskProcessDetail(taskUuid: string, robotClientUuid: string): Promise<TaskProcessDetailEntity[]> {
  const response = await client.post('/task/process-detail', {
    taskUuid,
    robotClientUuid,
  });
  return extractList<TaskProcessDetailEntity>(response.data?.data?.jobList || response.data);
}

export async function searchJobLogs(jobUuid: string, page = 1, size = 20, queryFilter?: Record<string, unknown>): Promise<JobLogSearchResult> {
  const response = await client.post('/job/logs/search', {
    jobUuid,
    page,
    size,
    queryFilter,
  });
  return response.data;
}

export async function queryJobLogs(requestId: string): Promise<JobLogSearchResult> {
  const response = await client.get('/job/logs/query', {
    params: { requestId },
  });
  return response.data;
}

export async function fetchRobotJobQueue(
  robotClientUuid: string,
  cursorId?: number,
  cursorDirection: 'pre' | 'next' = 'next',
  size = 20,
): Promise<RobotJobEntity[]> {
  const response = await client.post('/robot/jobs', {
    robotClientUuid,
    cursorId,
    cursorDirection,
    size,
  });
  return extractList<RobotJobEntity>(response.data);
}

export async function startTask(scheduleUuid: string, scheduleRelaParams?: any[]) {
  const response = await client.post('/task/start', { scheduleUuid, scheduleRelaParams });
  return response.data;
}

export async function stopTask(taskUuid: string) {
  const response = await client.post('/task/stop', { taskUuid });
  return response.data;
}

export async function retryTask(taskUuid: string) {
  const response = await client.post('/task/retry', { taskUuid });
  return response.data;
}

export async function fetchAllTaskDetails(taskUuids: string[]): Promise<TaskDetailEntity[]> {
  return mapWithConcurrency(taskUuids, 4, async (uuid) =>
    fetchTaskDetail(uuid)
      .then((response) => response)
      .catch((error) => {
        console.warn('[api-request]', {
          scope: 'task-detail',
          scheduleUuid: uuid,
          message: error?.message || 'unknown error',
        });
        return { error, scheduleUuid: uuid };
      }),
  );
}

export async function fetchDashboardBaseData(): Promise<DashboardBaseData> {
  const [appsRes, tasksRes, robotsRes, newestExecutions] = await Promise.all([
    fetchApps(),
    fetchTasks(),
    fetchRobots(),
    fetchNewestTaskExecutions().catch(() => []),
  ]);
  const apps = extractList<any>(appsRes).map((item) => ({
    ...item,
    appId: item.appId,
    appName: item.appName,
    robotUuid: item.robotUuid || item.appId,
    robotName: item.robotName || item.appName,
  })) as AppEntity[];
  const tasks = extractList<TaskEntity>(tasksRes);
  const robots = extractList<RobotEntity>(robotsRes);
  const [taskDetails, appRunRecords] = await Promise.all([
    tasks.length ? fetchAllTaskDetails(tasks.map((task) => task.scheduleUuid)) : Promise.resolve([]),
    fetchAppRunRecords().catch(() => []),
  ]);

  return { apps, tasks, robots, taskDetails, newestExecutions, appRunRecords };
}

export async function queryTaskResult(taskUuid: string) {
  const response = await client.post('/task/query', { taskUuid });
  return response.data;
}
