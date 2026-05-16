import { useEffect, useMemo, useRef, useState } from 'react';
import {
  extractList,
  fetchAppRunRecords,
  fetchApps,
  fetchRobotJobQueue,
  fetchRobots,
  fetchTaskDetail,
  fetchTaskExecutionsBySchedule,
  fetchTaskProcessDetail,
  fetchTasks,
  fetchNewestTaskExecutions,
} from './api';
import type { DebugSnapshot, ExecutionEntity, RobotEntity, TaskEntity } from './types';

type SnapshotMap = Record<string, DebugSnapshot>;

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function DetailedDebugView() {
  const [snapshots, setSnapshots] = useState<SnapshotMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    void loadDebugData();
  }, []);

  async function loadDebugData() {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const [appsRes, tasksRes, robotsRes, newestExecutions] = await Promise.all([
        fetchApps(),
        fetchTasks(),
        fetchRobots(),
        fetchNewestTaskExecutions().catch((err) => {
          throw new Error(`task/newest/list 失败: ${err?.message || 'unknown error'}`);
        }),
      ]);

      if (requestId !== requestIdRef.current) return;

      const apps = extractList<any>(appsRes);
      const tasks = extractList<TaskEntity>(tasksRes);
      const robots = extractList<RobotEntity>(robotsRes);
      const firstTask = tasks[0];
      const firstRobot = robots[0];
      const firstNewestExecution = newestExecutions[0];

      const baseSnapshots: SnapshotMap = {
        'app/open/query/list': {
          request: { page: '1', size: '100', note: '后端代理会按 page.pages 继续拉取全量应用' },
          response: appsRes,
          parsed: { count: apps.length, firstItem: apps[0] || null },
        },
        'dispatch/v2/schedule/list': {
          request: { key: '', enabled: true, scheduleType: 'period', page: 1, size: 50 },
          response: tasksRes,
          parsed: { count: tasks.length, firstItem: firstTask || null },
        },
        'dispatch/v2/client/list': {
          request: { page: 1, size: 50 },
          response: robotsRes,
          parsed: { count: robots.length, firstItem: firstRobot || null },
        },
        'dispatch/v2/task/newest/list': {
          request: { page: 1, size: 100 },
          response: newestExecutions,
          parsed: { count: newestExecutions.length, firstItem: firstNewestExecution || null },
        },
      };

      setSnapshots(baseSnapshots);

      if (!firstTask || !firstRobot) {
        return;
      }

      const taskDetail = await fetchTaskDetail(firstTask.scheduleUuid);
      if (requestId !== requestIdRef.current) return;

      const executions = await fetchTaskExecutionsBySchedule(firstTask.scheduleUuid);
      if (requestId !== requestIdRef.current) return;

      const firstExecution = (executions[0] || firstNewestExecution) as ExecutionEntity | undefined;
      const appRunRecords = await fetchAppRunRecords(0, 30).catch((err) => ({
        __error: err?.message || 'unknown error',
      }));
      if (requestId !== requestIdRef.current) return;

      const robotJobs = await fetchRobotJobQueue(firstRobot.robotClientUuid).catch((err) => ({
        __error: err?.message || 'unknown error',
      }));
      if (requestId !== requestIdRef.current) return;

      let taskProcessDetail: unknown = { skipped: '缺少 taskUuid/robotClientUuid' };
      if (firstExecution?.taskUuid && firstExecution?.robotClientUuid) {
        taskProcessDetail = await fetchTaskProcessDetail(firstExecution.taskUuid, firstExecution.robotClientUuid).catch((err) => ({
          __error: err?.message || 'unknown error',
        }));
      }

      setSnapshots((prev) => ({
        ...prev,
        'dispatch/v2/schedule/detail': {
          request: { scheduleUuid: firstTask.scheduleUuid },
          response: taskDetail,
          parsed: {
            keys: Object.keys(taskDetail || {}),
            robotListCount: taskDetail?.data?.robotList?.length || taskDetail?.robotList?.length || 0,
            robotClientListCount: taskDetail?.data?.robotClientList?.length || taskDetail?.robotClientList?.length || 0,
          },
        },
        'dispatch/v2/task/list': {
          request: { sourceUuid: firstTask.scheduleUuid, cursorDirection: 'next', size: 20 },
          response: executions,
          parsed: { count: executions.length, firstItem: firstExecution || null },
        },
        'dispatch/v2/task/process/detail': {
          request: firstExecution?.taskUuid && firstExecution?.robotClientUuid
            ? { taskUuid: firstExecution.taskUuid, robotClientUuid: firstExecution.robotClientUuid }
            : {},
          response: taskProcessDetail,
          parsed: Array.isArray(taskProcessDetail) ? { count: taskProcessDetail.length, firstItem: taskProcessDetail[0] || null } : taskProcessDetail,
        },
        'dispatch/v2/job/list': {
          request: { robotClientUuid: firstRobot.robotClientUuid, cursorDirection: 'next', size: 20 },
          response: robotJobs,
          parsed: Array.isArray(robotJobs) ? { count: robotJobs.length, firstItem: robotJobs[0] || null } : robotJobs,
        },
        'app/open/query/use/record/list': {
          request: { minId: 0, size: 30 },
          response: appRunRecords,
          parsed: Array.isArray(appRunRecords) ? { count: appRunRecords.length, firstItem: appRunRecords[0] || null } : appRunRecords,
        },
      }));
    } catch (err: any) {
      if (requestId === requestIdRef.current) {
        setError(err?.message || '详细诊断加载失败');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  const entries = useMemo(() => Object.entries(snapshots), [snapshots]);

  if (loading) return <div style={{ padding: 20 }}>加载中...</div>;
  if (error) return <div style={{ padding: 20, color: '#b42318' }}>错误: {error}</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12 }}>
      <h2>详细诊断</h2>
      <p>每个接口都展示请求体、原始响应和解析结果，便于确认字段映射是否正确。</p>
      {entries.map(([name, snapshot]) => (
        <section key={name} style={{ border: '1px solid #d0d5dd', padding: 16, marginBottom: 20, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>{name}</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <strong>Request</strong>
              <pre style={{ background: '#f6f8fa', padding: 12, overflow: 'auto' }}>{pretty(snapshot.request)}</pre>
            </div>
            <div>
              <strong>Response</strong>
              <pre style={{ background: '#f6f8fa', padding: 12, overflow: 'auto', maxHeight: 360 }}>{pretty(snapshot.response)}</pre>
            </div>
            <div>
              <strong>Parsed</strong>
              <pre style={{ background: '#f6f8fa', padding: 12, overflow: 'auto' }}>{pretty(snapshot.parsed)}</pre>
            </div>
            {snapshot.error ? <div style={{ color: '#b42318' }}>Error: {snapshot.error}</div> : null}
          </div>
        </section>
      ))}
    </div>
  );
}

export default DetailedDebugView;
