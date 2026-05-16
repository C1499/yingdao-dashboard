import { useEffect, useState } from 'react';
import {
  extractList,
  fetchAppRunRecords,
  fetchApps,
  fetchNewestTaskExecutions,
  fetchRobots,
  fetchTasks,
  queryJobLogs,
  searchJobLogs,
} from './api';

function DebugView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [jobLogPreview, setJobLogPreview] = useState<any>(null);

  useEffect(() => {
    void loadDebugData();
  }, []);

  async function loadDebugData() {
    try {
      setLoading(true);
      const [appsRes, tasksRes, robotsRes, newestExecutions, appRuns] = await Promise.all([
        fetchApps(),
        fetchTasks(),
        fetchRobots(),
        fetchNewestTaskExecutions().catch(() => []),
        fetchAppRunRecords(0, 30).catch(() => []),
      ]);

      const apps = extractList(appsRes);
      const tasks = extractList(tasksRes);
      const robots = extractList(robotsRes);

      setData({
        apps: { count: apps.length, firstItem: apps[0], fields: apps[0] ? Object.keys(apps[0]) : [] },
        tasks: { count: tasks.length, firstItem: tasks[0], fields: tasks[0] ? Object.keys(tasks[0]) : [] },
        robots: { count: robots.length, firstItem: robots[0], fields: robots[0] ? Object.keys(robots[0]) : [] },
        newestExecutions: { count: newestExecutions.length, firstItem: newestExecutions[0] },
        appRuns: { count: appRuns.length, firstItem: appRuns[0] },
      });

      const firstJobUuid = newestExecutions.find((item: any) => item.jobUuid)?.jobUuid;
      if (firstJobUuid) {
        const searchResult = await searchJobLogs(firstJobUuid).catch((err) => ({ error: err?.message || 'unknown error' }));
        let pollResult = null;
        const requestId =
          'requestId' in (searchResult || {}) ? (searchResult as any).requestId : (searchResult as any)?.data?.requestId;
        if (requestId) {
          pollResult = await queryJobLogs(requestId).catch((err) => ({ error: err?.message || 'unknown error' }));
        }
        setJobLogPreview({ searchResult, pollResult });
      }
    } catch (error) {
      console.error('Debug error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>加载中...</div>;
  if (!data) return <div style={{ padding: 20 }}>无数据</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12 }}>
      <h2>调试中心</h2>
      <div style={{ display: 'grid', gap: 20 }}>
        {Object.entries(data).map(([key, value]: [string, any]) => (
          <section key={key} style={{ border: '1px solid #d0d5dd', padding: 12, background: '#fff' }}>
            <h3 style={{ marginTop: 0 }}>{key}</h3>
            <p><strong>数量:</strong> {value.count}</p>
            {value.fields ? <p><strong>字段:</strong> {value.fields.join(', ')}</p> : null}
            <pre style={{ background: '#f6f8fa', padding: 12, overflow: 'auto' }}>
              {JSON.stringify(value.firstItem, null, 2)}
            </pre>
          </section>
        ))}

        <section style={{ border: '1px solid #d0d5dd', padding: 12, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>应用运行日志</h3>
          <pre style={{ background: '#f6f8fa', padding: 12, overflow: 'auto', maxHeight: 320 }}>
            {JSON.stringify(jobLogPreview, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

export default DebugView;
