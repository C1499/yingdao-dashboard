import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  fetchApps,
  fetchRobots,
  fetchTasks,
  fetchTaskDetail,
  fetchAppParams,
  fetchTaskExecutions,
  startTask,
  stopTask,
  retryTask,
  queryTaskResult,
  getCredentials,
  saveCredentials
} from './api';
import type { CredentialsPayload } from './api';

const tabs = ['settings', 'apps', 'tasks', 'robots'] as const;
type TabKey = (typeof tabs)[number];

interface App {
  robotUuid: string;
  robotName: string;
  description?: string;
  createTime?: string;
}

interface Task {
  scheduleUuid: string;
  scheduleName: string;
  type: string;
  enabled: boolean;
  cronExpression?: string;
  nextFireTime?: string;
  robotUuid?: string;
  accountName?: string; // 添加accountName字段
}

interface Robot {
  robotClientUuid: string;
  accountName: string;
  status: string;
  robotName?: string; // 可能有robotName
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const [credentials, setCredentials] = useState<CredentialsPayload>({ apiBaseUrl: 'https://api.yingdao.com', accessKeyId: '', accessKeySecret: '', accountName: '' });
  const [savedCredentials, setSavedCredentials] = useState<any>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCredentials();
  }, []);

  useEffect(() => {
    if (activeTab !== 'settings') {
      loadTabData(activeTab);
    }
  }, [activeTab]);

  async function loadCredentials() {
    try {
      setLoading(true);
      const saved = await getCredentials();
      if (saved) {
        setSavedCredentials(saved);
        setCredentials({
          apiBaseUrl: saved.apiBaseUrl || 'https://api.yingdao.com',
          accessKeyId: saved.accessKeyId || '',
          accessKeySecret: saved.accessKeySecret || '',
          accountName: saved.accountName || '',
        });
      }
    } catch (error) {
      console.warn(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTabData(tab: TabKey) {
    try {
      setLoading(true);
      setMessage('');
      if (tab === 'apps') {
        const data = await fetchApps();
        setApps(data?.data ?? data?.records ?? data?.rows ?? []);
      }
      if (tab === 'tasks') {
        const data = await fetchTasks();
        setTasks(data?.data ?? data?.records ?? data?.rows ?? []);
      }
      if (tab === 'robots') {
        const data = await fetchRobots();
        setRobots(data?.data ?? data?.records ?? data?.rows ?? []);
      }
    } catch (error: any) {
      setMessage(error?.message || '请求失败，请检查凭证和网络。');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCredentials(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      const saved = await saveCredentials(credentials);
      setSavedCredentials(saved);
      setMessage('凭证已保存');
    } catch (error: any) {
      setMessage(error?.message || '保存凭证失败');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded(id: string) {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  }

  const appTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.robotUuid) {
        if (!map.has(task.robotUuid)) {
          map.set(task.robotUuid, []);
        }
        map.get(task.robotUuid)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const taskAppsMap = useMemo(() => {
    const map = new Map<string, App | null>();
    tasks.forEach(task => {
      if (task.robotUuid) {
        const app = apps.find(a => a.robotUuid === task.robotUuid);
        map.set(task.scheduleUuid, app || null);
      }
    });
    return map;
  }, [tasks, apps]);

  const robotTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    robots.forEach(robot => {
      // 使用accountName关联机器人和任务
      const relatedTasks = tasks.filter(task => task.accountName === robot.accountName);
      if (relatedTasks.length > 0) {
        map.set(robot.robotClientUuid, relatedTasks);
      }
    });
    return map;
  }, [tasks, robots]);

  function exportExcel() {
    if (!apps.length && !tasks.length && !robots.length) {
      setMessage('当前没有数据可导出');
      return;
    }
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'apps') {
      data = apps.map(app => ({
        '应用名称': app.robotName,
        'UUID': app.robotUuid,
        '描述': app.description || '',
        '创建时间': app.createTime || '',
        '关联任务数量': appTasksMap.get(app.robotUuid)?.length || 0,
        '任务列表': appTasksMap.get(app.robotUuid)?.map(t => t.scheduleName).join('; ') || '',
      }));
      filename = 'yingdao-apps';
    } else if (activeTab === 'tasks') {
      data = tasks.map(task => {
        const app = taskAppsMap.get(task.scheduleUuid);
        return {
          '任务名称': task.scheduleName,
          '任务UUID': task.scheduleUuid,
          '类型': task.type,
          '启用': task.enabled ? '是' : '否',
          'Cron表达式': task.cronExpression || '',
          '下次执行时间': task.nextFireTime || '',
          '关联应用': app?.robotName || '无',
          '应用UUID': app?.robotUuid || '',
        };
      });
      filename = 'yingdao-tasks';
    } else if (activeTab === 'robots') {
      data = robots.map(robot => ({
        '机器人名称': robot.accountName,
        'UUID': robot.robotClientUuid,
        '状态': robot.status,
        '任务数量': robotTasksMap.get(robot.robotClientUuid)?.length || 0,
        '任务列表': robotTasksMap.get(robot.robotClientUuid)?.map(t => t.scheduleName).join('; ') || '',
      }));
      filename = 'yingdao-robots';
    }

    const sheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, activeTab);
    XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().slice(0, 19)}.xlsx`);
  }

  return (
    <div className="app-shell">
      <header>
        <h1>影刀任务仪表盘</h1>
        <div className="tabs">
          {tabs.map((tab) => (
            <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {tab === 'settings' ? '凭证设置' : tab === 'apps' ? '应用视图' : tab === 'tasks' ? '任务视图' : '机器人视图'}
            </button>
          ))}
        </div>
      </header>

      <main>
        {message && <div className="notice">{message}</div>}
        {loading && <div className="loading">加载中...</div>}

        {activeTab === 'settings' && (
          <form className="settings-form" onSubmit={handleSaveCredentials}>
            <label>
              API 地址
              <input
                value={credentials.apiBaseUrl}
                onChange={(event) => setCredentials({ ...credentials, apiBaseUrl: event.target.value })}
                placeholder="https://api.yingdao.com"
              />
            </label>
            <label>
              accessKeyId
              <input
                value={credentials.accessKeyId}
                onChange={(event) => setCredentials({ ...credentials, accessKeyId: event.target.value })}
                placeholder="请输入 accessKeyId"
              />
            </label>
            <label>
              accessKeySecret
              <input
                value={credentials.accessKeySecret}
                onChange={(event) => setCredentials({ ...credentials, accessKeySecret: event.target.value })}
                placeholder="请输入 accessKeySecret"
              />
            </label>
            <label>
              账户名称
              <input
                value={credentials.accountName}
                onChange={(event) => setCredentials({ ...credentials, accountName: event.target.value })}
                placeholder="可选，用于本地识别"
              />
            </label>
            <button type="submit">保存凭证</button>
          </form>
        )}

        {activeTab !== 'settings' && (
          <section className="data-panel">
            <div className="data-actions">
              <button onClick={() => loadTabData(activeTab)}>刷新</button>
              <button onClick={exportExcel}>导出Excel</button>
            </div>
            <div className="table-wrapper">
              {(() => {
                if (activeTab === 'apps' && apps.length === 0) return <p>当前没有应用数据，请先点击"刷新"加载。</p>;
                if (activeTab === 'tasks' && tasks.length === 0) return <p>当前没有任务数据，请先点击"刷新"加载。</p>;
                if (activeTab === 'robots' && robots.length === 0) return <p>当前没有机器人数据，请先点击"刷新"加载。</p>;

                return (
                  <table>
                    <thead>
                      <tr>
                        {activeTab === 'apps' && (
                          <>
                            <th>应用名称</th>
                            <th>UUID</th>
                            <th>描述</th>
                            <th>创建时间</th>
                            <th>关联任务数量</th>
                            <th>任务列表</th>
                          </>
                        )}
                        {activeTab === 'tasks' && (
                          <>
                            <th>任务名称</th>
                            <th>任务UUID</th>
                            <th>类型</th>
                            <th>启用</th>
                            <th>Cron表达式</th>
                            <th>下次执行时间</th>
                            <th>关联应用</th>
                            <th>应用UUID</th>
                          </>
                        )}
                        {activeTab === 'robots' && (
                          <>
                            <th>机器人名称</th>
                            <th>UUID</th>
                            <th>状态</th>
                            <th>任务数量</th>
                            <th>任务列表</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === 'apps' && apps.map((app) => {
                        const relatedTasks = appTasksMap.get(app.robotUuid) || [];
                        return (
                          <tr key={app.robotUuid}>
                            <td>{app.robotName}</td>
                            <td>{app.robotUuid}</td>
                            <td>{app.description || '无'}</td>
                            <td>{app.createTime || '未知'}</td>
                            <td>{relatedTasks.length}</td>
                            <td>{relatedTasks.map(t => t.scheduleName).join('; ') || '无'}</td>
                          </tr>
                        );
                      })}
                      {activeTab === 'tasks' && tasks.map((task) => {
                        const relatedApp = taskAppsMap.get(task.scheduleUuid);
                        return (
                          <tr key={task.scheduleUuid}>
                            <td>{task.scheduleName}</td>
                            <td>{task.scheduleUuid}</td>
                            <td>{task.type}</td>
                            <td>{task.enabled ? '是' : '否'}</td>
                            <td>{task.cronExpression || '无'}</td>
                            <td>{task.nextFireTime || '未知'}</td>
                            <td>{relatedApp?.robotName || '无'}</td>
                            <td>{relatedApp?.robotUuid || ''}</td>
                          </tr>
                        );
                      })}
                      {activeTab === 'robots' && robots.map((robot) => {
                        const relatedTasks = robotTasksMap.get(robot.robotClientUuid) || [];
                        return (
                          <tr key={robot.robotClientUuid}>
                            <td>{robot.accountName}</td>
                            <td>{robot.robotClientUuid}</td>
                            <td>{robot.status}</td>
                            <td>{relatedTasks.length}</td>
                            <td>{relatedTasks.map(t => t.scheduleName).join('; ') || '无'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;