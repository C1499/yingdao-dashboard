import { useEffect, useMemo, useState } from 'react';
import {
  fetchDashboardBaseData,
  fetchRobotDetail,
  fetchRobotJobQueue,
  fetchTaskProcessDetail,
  fetchTaskExecutionsBySchedule,
  getCredentials,
  searchJobLogs,
  saveCredentials,
} from './api';
import DataTablePanel from './components/DataTablePanel';
import DetailDrawer from './components/DetailDrawer';
import ModuleConfigurator from './components/ModuleConfigurator';
import TimelinePanel from './components/TimelinePanel';
import ViewSummaryCards from './components/ViewSummaryCards';
import DebugView from './DebugView';
import DetailedDebugView from './DetailedDebugView';
import type {
  AppEntity,
  AppRunRecordEntity,
  AppTabKey,
  ColumnConfig,
  CredentialsPayload,
  DrawerSection,
  ExecutionEntity,
  FilterConfig,
  JobLogEntity,
  MainViewKey,
  RobotDetailEntity,
  RobotJobEntity,
  RobotEntity,
  SortConfig,
  SummaryCardItem,
  TaskProcessDetailEntity,
  TaskDetailEntity,
  TaskEntity,
  TaskViewRow,
  TimelineAppRunItem,
  TimelineItem,
} from './types';
import { buildDashboardData } from './utils/dataMappers';
import { getStatusTone } from './utils/statusTone';
import { defaultColumns, defaultModules, mainViewTabs, utilityTabs } from './utils/viewConfigs';

const SAVED_VIEWS_KEY = 'yingdao-dashboard-saved-views-v1';

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimelineRawTime(item: TimelineItem) {
  return item.type === 'future' ? item.scheduledTime : item.executionTime;
}

function getExecutionIdentity(execution: ExecutionEntity) {
  return [
    execution.id,
    execution.taskUuid,
    execution.sourceUuid || execution.scheduleUuid,
    execution.robotClientUuid,
    execution.currentRobotUuid,
    execution.startTime || execution.createTime,
    execution.endTime || execution.updateTime,
    execution.status,
  ].map((item) => String(item || '')).join('|');
}

function dedupeExecutions(executions: ExecutionEntity[]) {
  return Array.from(new Map(executions.map((execution) => [getExecutionIdentity(execution), execution])).values());
}

function isSameInputDate(value: string, inputDate: string) {
  if (!value || value === '无' || value === '未执行') return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return value.slice(0, 10).replace(/\//g, '-') === inputDate;
  }
  return toDateInputValue(new Date(time)) === inputDate;
}

function startOfInputDate(inputDate: string) {
  const date = new Date(`${inputDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeForTimeline(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeCronWeekday(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}

function parseCronField(field: string, min: number, max: number, value: number, isWeekday = false) {
  if (field === '*') return true;

  return field.split(',').some((segment) => {
    const part = segment.trim();
    if (!part) return false;

    const normalizeValue = (input: number) => {
      if (!isWeekday) return input;
      if (input === 0 || input === 7) return 7;
      return input;
    };

    const currentValue = normalizeValue(value);

    if (part.includes('/')) {
      const [baseRaw, stepRaw] = part.split('/');
      const step = Number(stepRaw);
      if (!Number.isFinite(step) || step <= 0) return false;

      let start = min;
      let end = max;

      if (baseRaw && baseRaw !== '*') {
        if (baseRaw.includes('-')) {
          const [rangeStartRaw, rangeEndRaw] = baseRaw.split('-');
          const rangeStart = Number(rangeStartRaw);
          const rangeEnd = Number(rangeEndRaw);
          if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) return false;
          start = normalizeValue(rangeStart);
          end = normalizeValue(rangeEnd);
        } else {
          const parsedStart = Number(baseRaw);
          if (!Number.isFinite(parsedStart)) return false;
          start = normalizeValue(parsedStart);
        }
      }

      if (currentValue < start || currentValue > end) return false;
      return (currentValue - start) % step === 0;
    }

    if (part.includes('-')) {
      const [startRaw, endRaw] = part.split('-');
      const start = normalizeValue(Number(startRaw));
      const end = normalizeValue(Number(endRaw));
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return currentValue >= start && currentValue <= end;
    }

    const parsed = normalizeValue(Number(part));
    return Number.isFinite(parsed) && currentValue === parsed;
  });
}

function matchesCronExpression(expression: string, date: Date) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, weekday] = parts;

  return (
    parseCronField(minute, 0, 59, date.getMinutes()) &&
    parseCronField(hour, 0, 23, date.getHours()) &&
    parseCronField(dayOfMonth, 1, 31, date.getDate()) &&
    parseCronField(month, 1, 12, date.getMonth() + 1) &&
    parseCronField(weekday, 1, 7, normalizeCronWeekday(date.getDay()), true)
  );
}

function buildTaskScheduleTimesForDate(taskRow: TaskViewRow, inputDate: string) {
  const dateStart = startOfInputDate(inputDate);
  if (!dateStart || !taskRow.task.enabled) return [];

  const cron = taskRow.task.cronInterface || {};
  const type = cron.type || taskRow.task.scheduleType || taskRow.task.type;
  const results: string[] = [];

  if (type === 'cron' && cron.cronExpress) {
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const candidate = new Date(dateStart.getTime() + minute * 60 * 1000);
      if (matchesCronExpression(cron.cronExpress, candidate)) {
        results.push(formatDateTimeForTimeline(candidate));
      }
    }
    return results;
  }

  if (type === 'day' && Number.isFinite(Number(cron.hour)) && Number.isFinite(Number(cron.minute))) {
    const candidate = new Date(dateStart);
    candidate.setHours(Number(cron.hour), Number(cron.minute), 0, 0);
    return [formatDateTimeForTimeline(candidate)];
  }

  if (type === 'minute' && Number.isFinite(Number(cron.minute)) && Number(cron.minute) > 0) {
    const interval = Number(cron.minute);
    for (let minute = 0; minute < 24 * 60; minute += interval) {
      const candidate = new Date(dateStart.getTime() + minute * 60 * 1000);
      results.push(formatDateTimeForTimeline(candidate));
    }
    return results;
  }

  if (taskRow.task.nextFireTime && isSameInputDate(taskRow.task.nextFireTime, inputDate)) {
    return [formatDateTimeForTimeline(new Date(taskRow.task.nextFireTime))];
  }

  return [];
}

interface SavedDashboardView {
  id: string;
  name: string;
  view: MainViewKey;
  filters: FilterConfig;
  sortConfig: SortConfig;
  columnVisibility: Record<string, boolean>;
  moduleVisibility: Record<string, boolean>;
  moduleOrder: string[];
  createdAt: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTabKey>('machines');
  const [credentials, setCredentials] = useState<CredentialsPayload>({
    apiBaseUrl: 'https://api.yingdao.com',
    accessKeyId: '',
    accessKeySecret: '',
    accountName: '',
  });
  const [apps, setApps] = useState<AppEntity[]>([]);
  const [tasks, setTasks] = useState<TaskEntity[]>([]);
  const [robots, setRobots] = useState<RobotEntity[]>([]);
  const [taskDetails, setTaskDetails] = useState<TaskDetailEntity[]>([]);
  const [appRunRecords, setAppRunRecords] = useState<AppRunRecordEntity[]>([]);
  const [executionMap, setExecutionMap] = useState<Record<string, ExecutionEntity[]>>({});
  const [robotJobMap, setRobotJobMap] = useState<Record<string, RobotJobEntity[]>>({});
  const [robotDetailMap, setRobotDetailMap] = useState<Record<string, RobotDetailEntity>>({});
  const [taskProcessMap, setTaskProcessMap] = useState<Record<string, TaskProcessDetailEntity[]>>({});
  const [loading, setLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logDrawerTitle, setLogDrawerTitle] = useState('');
  const [logDrawerSections, setLogDrawerSections] = useState<DrawerSection[]>([]);
  const [savedViews, setSavedViews] = useState<SavedDashboardView[]>([]);
  const [activeSavedViewId, setActiveSavedViewId] = useState('');
  const [selectedTimelineDate, setSelectedTimelineDate] = useState(() => toDateInputValue());
  const [selectedTimelineMachine, setSelectedTimelineMachine] = useState('all');

  const [filtersByView, setFiltersByView] = useState<Record<MainViewKey, FilterConfig>>({
    machines: {},
    tasks: {},
    apps: {},
    timeline: {},
  });
  const [sortByView, setSortByView] = useState<Record<MainViewKey, SortConfig>>({
    machines: { column: '', direction: null, rules: [] },
    tasks: { column: '', direction: null, rules: [] },
    apps: { column: '', direction: null, rules: [] },
    timeline: { column: '', direction: null, rules: [] },
  });
  const [panelState, setPanelState] = useState<Record<MainViewKey, { filters: boolean; columns: boolean; modules: boolean }>>({
    machines: { filters: false, columns: false, modules: false },
    tasks: { filters: false, columns: false, modules: false },
    apps: { filters: false, columns: false, modules: false },
    timeline: { filters: false, columns: false, modules: false },
  });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean>>({});
  const [moduleOrder, setModuleOrder] = useState<Record<MainViewKey, string[]>>({
    machines: defaultModules.machines.map((item) => item.key),
    tasks: defaultModules.tasks.map((item) => item.key),
    apps: defaultModules.apps.map((item) => item.key),
    timeline: defaultModules.timeline.map((item) => item.key),
  });

  const activeMainView = (['machines', 'tasks', 'apps', 'timeline'] as MainViewKey[]).includes(activeTab as MainViewKey)
    ? (activeTab as MainViewKey)
    : null;

  useEffect(() => {
    loadCredentials();
    loadSavedViews();
    loadDashboardBaseData();
  }, []);

  function loadSavedViews() {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch (error) {
      console.warn('[saved-view]', error);
    }
  }

  function persistSavedViews(nextViews: SavedDashboardView[]) {
    setSavedViews(nextViews);
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(nextViews));
  }

  async function loadCredentials() {
    try {
      const saved = await getCredentials();
      if (!saved) return;
      setCredentials({
        apiBaseUrl: saved.apiBaseUrl || 'https://api.yingdao.com',
        accessKeyId: saved.accessKeyId || '',
        accessKeySecret: saved.accessKeySecret || '',
        accountName: saved.accountName || '',
      });
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadDashboardBaseData() {
    try {
      setLoading(true);
      setMessage('');
      const data = await fetchDashboardBaseData();
      setApps(data.apps);
      setTasks(data.tasks);
      setRobots(data.robots);
      setTaskDetails(data.taskDetails);
      setAppRunRecords(data.appRunRecords);
      setExecutionMap((prev) => {
        const seeded = { ...prev };
        data.newestExecutions.forEach((execution) => {
          const sourceUuid = execution.sourceUuid || execution.scheduleUuid;
          if (!sourceUuid) return;
          seeded[sourceUuid] = dedupeExecutions([...(seeded[sourceUuid] || []), execution]);
        });
        return seeded;
      });
    } catch (error: any) {
      setMessage(error?.message || '基础数据加载失败，请检查凭证和网络。');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCredentials(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      await saveCredentials(credentials);
      setMessage('凭证已保存');
      await loadDashboardBaseData();
    } catch (error: any) {
      setMessage(error?.message || '保存凭证失败');
    } finally {
      setLoading(false);
    }
  }

  const dashboardData = useMemo(
    () => buildDashboardData(apps, appRunRecords, tasks, robots, taskDetails, executionMap, robotJobMap),
    [apps, appRunRecords, tasks, robots, taskDetails, executionMap, robotJobMap],
  );

  const currentColumns = useMemo(() => {
    if (!activeMainView) return [] as ColumnConfig[];
    return defaultColumns[activeMainView].map((column) => ({
      ...column,
      visible: columnVisibility[`${activeMainView}-${column.key}`] ?? column.visible,
    }));
  }, [activeMainView, columnVisibility]);

  const processedRows = useMemo(() => {
    if (!activeMainView || activeMainView === 'timeline') return [];
    let rows = [...dashboardData[activeMainView]];
    const filters = filtersByView[activeMainView];
    const sortConfig = sortByView[activeMainView];

    if (Object.values(filters).some((filterValue) => filterValue.length > 0)) {
      rows = rows.filter((item) =>
        Object.entries(filters).every(([key, filterValue]) => {
          if (!filterValue.length) return true;
          const rawValue = ((item as unknown as Record<string, unknown>)[key]);
          const itemValues = Array.isArray(rawValue) ? rawValue.map((value) => String(value)) : [String(rawValue ?? '')];
          return filterValue.some((selected) =>
            itemValues.some((value) => value.toLowerCase().includes(selected.toLowerCase())),
          );
        }),
      );
    }

    const sortRules = sortConfig.rules?.length
      ? sortConfig.rules
      : sortConfig.direction && sortConfig.column
        ? [{ column: sortConfig.column, direction: sortConfig.direction }]
        : [];

    if (sortRules.length > 0) {
      rows.sort((a: any, b: any) => {
        for (const rule of sortRules) {
          const aVal = a[rule.column];
          const bVal = b[rule.column];

          if (aVal == null && bVal == null) continue;
          if (aVal == null) return rule.direction === 'asc' ? -1 : 1;
          if (bVal == null) return rule.direction === 'asc' ? 1 : -1;

          let compareResult = 0;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            compareResult = aVal - bVal;
          } else {
            compareResult = String(aVal).localeCompare(String(bVal), 'zh-CN');
          }

          if (compareResult !== 0) {
            return rule.direction === 'asc' ? compareResult : -compareResult;
          }
        }
        return 0;
      });
    }

    return rows;
  }, [activeMainView, dashboardData, filtersByView, sortByView]);

  const timelineMachineOptions = useMemo(() => {
    return Array.from(
      new Set(
        dashboardData.machines
          .map((item) => item.machineName)
          .filter((item) => item && item !== '无'),
      ),
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [dashboardData.machines]);

  const timelineData = useMemo(() => {
    const items = dashboardData.timeline;
    const selectedItems = items.filter((item) => isSameInputDate(getTimelineRawTime(item), selectedTimelineDate));
    const getTimeValue = (item: TimelineItem) => {
      const time = new Date(getTimelineRawTime(item)).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    const history = selectedItems.filter((item) => item.type === 'history').sort((a, b) => getTimeValue(b) - getTimeValue(a));
    const schedulePoints = dashboardData.tasks
      .flatMap<TimelineAppRunItem>((taskRow) =>
        buildTaskScheduleTimesForDate(taskRow, selectedTimelineDate).map((executionTime, index) => ({
          id: `schedule-${taskRow.scheduleUuid}-${executionTime}-${index}`,
          appName: taskRow.plannedAppNames.length ? taskRow.plannedAppNames.join(' / ') : '无关联应用',
          status: taskRow.task.enabled ? '计划中' : '已停用',
          executionTime,
          executionDuration: '--',
          nextExecutionTime: executionTime,
          relatedTaskNames: taskRow.scheduleName ? [taskRow.scheduleName] : [],
          relatedMachineNames: taskRow.plannedRobotNames || [],
          sourceType: 'future',
        })),
      )
      .sort((a, b) => {
        const aTime = new Date(a.executionTime).getTime();
        const bTime = new Date(b.executionTime).getTime();
        return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
      });

    const scheduleRuns = [
      ...history.map<TimelineAppRunItem>((item) => ({
        id: item.id,
        appName: item.appName || '无关联应用',
        status: item.status,
        executionTime: item.executionTime,
        executionDuration: item.executionDuration,
        nextExecutionTime: item.scheduledTime,
        relatedTaskNames: item.taskName ? [item.taskName] : [],
        relatedMachineNames: item.machineNames || [],
        sourceType: 'history',
      })),
      ...schedulePoints,
    ].sort((a, b) => {
      const aTime = new Date(a.executionTime).getTime();
      const bTime = new Date(b.executionTime).getTime();
      return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
    });

    const machineMatches = (names: string[]) => {
      if (selectedTimelineMachine === 'all') return true;
      return names.includes(selectedTimelineMachine);
    };

    const globalSummary = {
      scheduleCount: scheduleRuns.length,
      hourCount: new Set(scheduleRuns.map((item) => item.executionTime.slice(11, 13))).size,
      appCount: new Set(scheduleRuns.map((item) => item.appName)).size,
      machineCount: new Set(scheduleRuns.flatMap((item) => item.relatedMachineNames)).size,
      historyCount: history.length,
      failureCount: history.filter((item) => {
        const status = item.status.toLowerCase();
        return status.includes('error') || status.includes('fail') || item.status.includes('异常') || item.status.includes('失败');
      }).length,
      runnableLogCount: history.filter((item) => item.logAvailable).length,
    };

    const filteredHistory = history.filter((item) => {
      return machineMatches(item.machineNames || []);
    });

    const filteredScheduleRuns = scheduleRuns.filter((item) => machineMatches(item.relatedMachineNames));

    const localSummary = {
      scheduleCount: filteredScheduleRuns.length,
      appCount: new Set(filteredScheduleRuns.map((item) => item.appName)).size,
      machineCount: new Set(filteredScheduleRuns.flatMap((item) => item.relatedMachineNames)).size,
    };

    return {
      globalSummary,
      localSummary,
      history: filteredHistory,
      scheduleRuns: filteredScheduleRuns,
    };
  }, [dashboardData.tasks, dashboardData.timeline, selectedTimelineDate, selectedTimelineMachine]);

  const visibleSummaryCards = useMemo(() => {
    if (!activeMainView) return [] as SummaryCardItem[];
    const orderedKeys = moduleOrder[activeMainView];
    const summaryMap = new Map(dashboardData.summary[activeMainView].map((item) => [item.key, item]));
    return orderedKeys
      .filter((key) => moduleVisibility[key] !== false)
      .map((key) => summaryMap.get(key))
      .filter(Boolean) as SummaryCardItem[];
  }, [activeMainView, dashboardData.summary, moduleOrder, moduleVisibility]);

  function togglePanel(key: 'filters' | 'columns' | 'modules') {
    if (!activeMainView) return;
    setPanelState((prev) => ({
      ...prev,
      [activeMainView]: {
        ...prev[activeMainView],
        [key]: !prev[activeMainView][key],
      },
    }));
  }

  function handleFilterChange(key: string, value: string[]) {
    if (!activeMainView) return;
    setActiveSavedViewId('');
    setFiltersByView((prev) => ({
      ...prev,
      [activeMainView]: { ...prev[activeMainView], [key]: value },
    }));
  }

  function resetFilters() {
    if (!activeMainView) return;
    setFiltersByView((prev) => ({ ...prev, [activeMainView]: {} }));
    setActiveSavedViewId('');
  }

  function saveCurrentView() {
    if (!activeMainView) return;
    const defaultName = `${mainViewTabs.find((tab) => tab.key === activeMainView)?.label || activeMainView}视图`;
    const name = window.prompt('视图名称', defaultName);
    if (!name?.trim()) return;
    const prefix = `${activeMainView}-`;
    const nextView: SavedDashboardView = {
      id: `${activeMainView}-${Date.now()}`,
      name: name.trim(),
      view: activeMainView,
      filters: filtersByView[activeMainView],
      sortConfig: sortByView[activeMainView],
      columnVisibility: Object.fromEntries(Object.entries(columnVisibility).filter(([key]) => key.startsWith(prefix))),
      moduleVisibility,
      moduleOrder: moduleOrder[activeMainView],
      createdAt: new Date().toISOString(),
    };
    persistSavedViews([nextView, ...savedViews].slice(0, 30));
    setActiveSavedViewId(nextView.id);
  }

  function applySavedView(viewId: string) {
    setActiveSavedViewId(viewId);
    if (!viewId) return;
    const savedView = savedViews.find((item) => item.id === viewId);
    if (!savedView) return;
    setActiveTab(savedView.view);
    setFiltersByView((prev) => ({ ...prev, [savedView.view]: savedView.filters || {} }));
    setSortByView((prev) => ({ ...prev, [savedView.view]: savedView.sortConfig || { column: '', direction: null, rules: [] } }));
    setColumnVisibility((prev) => ({ ...prev, ...(savedView.columnVisibility || {}) }));
    setModuleVisibility((prev) => ({ ...prev, ...(savedView.moduleVisibility || {}) }));
    setModuleOrder((prev) => ({ ...prev, [savedView.view]: savedView.moduleOrder || prev[savedView.view] }));
  }

  function deleteSavedView() {
    if (!activeSavedViewId) return;
    const nextViews = savedViews.filter((item) => item.id !== activeSavedViewId);
    persistSavedViews(nextViews);
    setActiveSavedViewId('');
  }

  function handleSort(column: string) {
    if (!activeMainView) return;
    setActiveSavedViewId('');
    setSortByView((prev) => {
      const current = prev[activeMainView];
      const rules = [...(current.rules || [])];
      const index = rules.findIndex((rule) => rule.column === column);

      if (index < 0) {
        rules.push({ column, direction: 'asc' });
      } else if (rules[index].direction === 'asc') {
        rules[index] = { column, direction: 'desc' };
      } else {
        rules.splice(index, 1);
      }

      const primaryRule = rules[0];
      return {
        ...prev,
        [activeMainView]: {
          column: primaryRule?.column || '',
          direction: primaryRule?.direction || null,
          rules,
        },
      };
    });
  }

  function updateColumnVisibility(key: string, visible: boolean) {
    if (!activeMainView) return;
    setActiveSavedViewId('');
    setColumnVisibility((prev) => ({ ...prev, [`${activeMainView}-${key}`]: visible }));
  }

  function toggleModuleVisibility(key: string, visible: boolean) {
    setActiveSavedViewId('');
    setModuleVisibility((prev) => ({ ...prev, [key]: visible }));
  }

  function moveModule(view: MainViewKey, key: string, direction: 'up' | 'down') {
    setActiveSavedViewId('');
    setModuleOrder((prev) => {
      const list = [...prev[view]];
      const index = list.indexOf(key);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
      return { ...prev, [view]: list };
    });
  }

  async function handleRowClick(item: any) {
    if (!activeMainView || activeMainView === 'timeline') return;
    setSelectedRecord(item);
    setDrawerOpen(true);

    const taskIds =
      activeMainView === 'tasks'
        ? [item.scheduleUuid]
        : activeMainView === 'machines'
          ? (item.tasks || []).map((task: TaskEntity) => task.scheduleUuid)
          : (item.tasks || []).map((task: TaskEntity) => task.scheduleUuid);

    try {
      setDrawerLoading(true);
      let hydratedExecutionMap = executionMap;
      const missingTaskIds = taskIds.filter((taskId: string) => !executionMap[taskId]);
      if (missingTaskIds.length > 0) {
        const entries = await Promise.all(
          missingTaskIds.map(async (taskId: string) => {
            return [taskId, await fetchTaskExecutionsBySchedule(taskId)] as const;
          }),
        );
        hydratedExecutionMap = { ...executionMap };
        entries.forEach(([taskId, executions]) => {
          hydratedExecutionMap[taskId] = executions;
        });
        setExecutionMap(hydratedExecutionMap);
      }

      if (activeMainView === 'machines' && item.robot?.robotClientUuid && !robotJobMap[item.robot.robotClientUuid]) {
        const jobs = await fetchRobotJobQueue(item.robot.robotClientUuid);
        console.log('[robot-jobs]', {
          robotClientUuid: item.robot.robotClientUuid,
          machineName: item.machineName,
          queueSize: jobs.length,
          statuses: jobs.map((job) => job.status),
        });
        setRobotJobMap((prev) => ({
          ...prev,
          [item.robot.robotClientUuid]: jobs,
        }));
      }

      if (
        activeMainView === 'machines' &&
        item.robot?.robotClientUuid &&
        !robotDetailMap[item.robot.robotClientUuid]
      ) {
        const robotDetail = await fetchRobotDetail(item.robot.robotClientName || item.robot.accountName, item.robot.robotClientUuid);
        if (robotDetail) {
          console.log('[robot-detail]', robotDetail);
          setRobotDetailMap((prev) => ({
            ...prev,
            [item.robot.robotClientUuid]: robotDetail,
          }));
        }
      }

      if (activeMainView === 'tasks' && item.scheduleUuid && !taskProcessMap[item.scheduleUuid]) {
        const processTargets = Array.from(
          new Map(
            (hydratedExecutionMap[item.scheduleUuid] || [])
              .filter((execution) => execution.taskUuid && execution.robotClientUuid)
              .map((execution) => [`${execution.taskUuid}:${execution.robotClientUuid}`, execution]),
          ).values(),
        );
        const processEntries = await Promise.all(
          processTargets.map(async (execution) =>
            fetchTaskProcessDetail(execution.taskUuid!, execution.robotClientUuid!).catch((error) => {
              console.warn('[api-request]', {
                scope: 'task-process-detail',
                scheduleUuid: item.scheduleUuid,
                taskUuid: execution.taskUuid,
                robotClientUuid: execution.robotClientUuid,
                message: error?.message || 'unknown error',
              });
              return [];
            }),
          ),
        );
        setTaskProcessMap((prev) => ({
          ...prev,
          [item.scheduleUuid]: processEntries.flat(),
        }));
      }
    } catch (error) {
      console.warn(error);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function handleTimelineLogClick(item: TimelineItem) {
    const raw = item.raw as ExecutionEntity | undefined;
    try {
      setDrawerLoading(true);
      let jobUuid = item.jobUuid || (raw as any)?.jobUuid;
      if (!jobUuid && raw?.taskUuid && raw?.robotClientUuid) {
        const processDetails = await fetchTaskProcessDetail(raw.taskUuid, raw.robotClientUuid);
        jobUuid = processDetails.find((detail) => detail.jobUuid)?.jobUuid;
      }

      if (!jobUuid) {
        setLogDrawerTitle(`${item.taskName} · 日志`);
        setLogDrawerSections([
          {
            title: '日志不可用',
            notice: '当前执行记录没有 jobUuid，也无法从 task/process/detail 解析到应用运行记录。',
          },
        ]);
        setLogDrawerOpen(true);
        return;
      }

      const result = await searchJobLogs(jobUuid);
      const logs = ((result as any)?.data?.logs || (result as any)?.logs || []) as JobLogEntity[];
      setLogDrawerTitle(`${item.taskName} · 运行日志`);
      setLogDrawerSections([
        {
          title: '日志信息',
          fields: [
            { label: 'Job UUID', value: jobUuid },
            { label: 'Request ID', value: (result as any)?.data?.requestId || (result as any)?.requestId || '无' },
            { label: '日志数量', value: logs.length },
          ],
        },
        {
          title: '日志内容',
          logs,
          raw: logs as unknown as Array<Record<string, unknown>>,
        },
      ]);
      setLogDrawerOpen(true);
    } catch (error: any) {
      setLogDrawerTitle(`${item.taskName} · 日志`);
      setLogDrawerSections([{ title: '日志查询失败', notice: error?.message || '未知错误' }]);
      setLogDrawerOpen(true);
    } finally {
      setDrawerLoading(false);
    }
  }

  const drawerSections = useMemo(() => {
    if (!activeMainView || !selectedRecord) return [];
    const baseSections = dashboardData.drawerSections[`${activeMainView}:${selectedRecord.id}`] || [];

    if (activeMainView !== 'machines') {
      if (activeMainView === 'tasks') {
        const processDetails = taskProcessMap[selectedRecord.scheduleUuid] || [];
        const processSection: DrawerSection = {
          title: '应用运行明细',
          timeline: processDetails.length
            ? processDetails.map((item) => ({
                title: `${item.robotName || '未知应用'} · ${item.statusName || item.status || '未知状态'}`,
                meta: item.remark || item.endTime || item.startTime || '无明细',
                tone: ((item.status || '').toLowerCase().includes('fail') || (item.remark || '').toLowerCase().includes('error'))
                  ? ('danger' as const)
                  : ((item.status || '').toLowerCase().includes('run') ? ('warning' as const) : ('success' as const)),
              }))
            : [{ title: '暂无应用运行明细', meta: '未查询到 task/process/detail 数据', tone: 'default' as const }],
          raw: processDetails as unknown as Array<Record<string, unknown>>,
        };
        return [
          ...baseSections,
          processSection,
        ];
      }
      return baseSections;
    }

    const robotClientUuid = selectedRecord.robot?.robotClientUuid;
    const robotDetail = robotClientUuid ? robotDetailMap[robotClientUuid] : null;
    const jobs = robotClientUuid ? robotJobMap[robotClientUuid] || [] : [];
    const enhancedBaseSections = [...baseSections];

    if (robotDetail && enhancedBaseSections[0]?.fields) {
      enhancedBaseSections[0] = {
        ...enhancedBaseSections[0],
        fields: [
          ...enhancedBaseSections[0].fields,
          { label: '机器人账号', value: robotDetail.robotClientName },
          { label: '机器人备注', value: robotDetail.description || robotDetail.remark || '无' },
          { label: '客户端IP', value: robotDetail.clientIp || '无' },
        ],
      };
    }

    const queueSection = {
      title: '机器人任务队列',
      timeline: jobs.length
        ? jobs.map((job) => ({
            title: `${job.taskName || job.robotName || '未知任务'} · ${job.statusName || job.status || '未知状态'}`,
            meta: job.startTime || job.triggerTime || job.endTime || '无时间',
            tone: (job.status || '').toLowerCase().includes('fail') || (job.status || '').toLowerCase().includes('error')
              ? ('danger' as const)
              : (job.status || '').toLowerCase().includes('wait') || (job.status || '').toLowerCase().includes('run')
                ? ('warning' as const)
                : ('success' as const),
          }))
        : [{ title: '暂无队列数据', meta: '未查询到该机器的队列信息', tone: 'default' as const }],
    };

    return [...enhancedBaseSections, queueSection];
  }, [activeMainView, dashboardData.drawerSections, robotDetailMap, robotJobMap, selectedRecord, taskProcessMap]);

  function renderCellValue(item: any, key: string) {
    const value = item[key];
    if (value === null || value === undefined || value === '') {
      return <span className="cell-empty">无</span>;
    }

    if (Array.isArray(value)) {
      if (!value.length) return <span className="cell-empty">无</span>;
      return (
        <span className="cell-tags">
          {value.slice(0, 6).map((item: string) => (
            <span key={`${key}-${item}`} className="cell-tag">{item}</span>
          ))}
          {value.length > 6 ? <span className="cell-tag muted">+{value.length - 6}</span> : null}
        </span>
      );
    }

    if (['onlineStatus', 'currentStatus', 'latestStatus', 'latestExecutionResult', 'enabledLabel'].includes(key)) {
      const tone = getStatusTone(String(value));
      return <span className={`badge-status ${tone}`}>{String(value)}</span>;
    }

    if (key === 'latestFailure') {
      return String(value) === '无'
        ? <span className="cell-empty">无</span>
        : <span className="cell-alert cell-alert-danger">{String(value)}</span>;
    }

    if (['todayPendingCount', 'relatedTaskCount', 'relatedAppCount', 'relatedMachineCount'].includes(key)) {
      return <span className="cell-count">{String(value)}</span>;
    }

    if (['nextExecutionTime', 'latestExecutionTime', 'latestExecutionDuration'].includes(key)) {
      return <span className="cell-time">{String(value)}</span>;
    }

    if (['appName', 'robotName', 'scheduleName', 'machineName', 'currentTask'].includes(key)) {
      return <span className="cell-name">{String(value)}</span>;
    }

    return <span>{String(value)}</span>;
  }

  function getDrawerTitle() {
    if (!activeMainView || !selectedRecord) return '';
    if (activeMainView === 'machines') return selectedRecord.machineName;
    if (activeMainView === 'tasks') return selectedRecord.scheduleName;
    return selectedRecord.appName;
  }

  function getDrawerSubtitle() {
    if (!activeMainView || !selectedRecord) return '';
    if (activeMainView === 'machines') return `机器人：${selectedRecord.robotClientName}`;
    if (activeMainView === 'tasks') return `任务UUID：${selectedRecord.scheduleUuid}`;
    return `应用UUID：${selectedRecord.appId || selectedRecord.robotUuid}`;
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <h1>影刀调度运维台</h1>
          <p>多视图调度、执行排查与关联信息总览</p>
        </div>
        <div className="utility-tabs">
          {utilityTabs.map((tab) => (
            <button
              key={tab.key}
              className={`utility-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="tabs">
          {mainViewTabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {message ? <div className="notice">{message}</div> : null}
        {loading ? <div className="loading">加载中...</div> : null}

        {activeMainView ? (
          <div className="saved-view-bar">
            <div className="saved-view-copy">
              <strong>保存视图</strong>
              <span>把当前筛选、排序、字段和模块配置保存到本地浏览器。</span>
            </div>
            <div className="saved-view-controls">
              <select value={activeSavedViewId} onChange={(event) => applySavedView(event.target.value)}>
                <option value="">选择已保存视图</option>
                {savedViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name} · {mainViewTabs.find((tab) => tab.key === view.view)?.label || view.view}
                  </option>
                ))}
              </select>
              <button type="button" className="action-button" onClick={saveCurrentView}>保存当前视图</button>
              <button type="button" className="action-button subtle" disabled={!activeSavedViewId} onClick={deleteSavedView}>删除</button>
            </div>
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <form className="settings-form" onSubmit={handleSaveCredentials}>
            <div className="form-section">
              <h2>API 配置</h2>
              <label>
                <span className="label-text">API 地址</span>
                <input value={credentials.apiBaseUrl} onChange={(event) => setCredentials({ ...credentials, apiBaseUrl: event.target.value })} />
              </label>
              <label>
                <span className="label-text">Access Key ID</span>
                <input value={credentials.accessKeyId} onChange={(event) => setCredentials({ ...credentials, accessKeyId: event.target.value })} />
              </label>
              <label>
                <span className="label-text">Access Key Secret</span>
                <input type="password" value={credentials.accessKeySecret} onChange={(event) => setCredentials({ ...credentials, accessKeySecret: event.target.value })} />
              </label>
              <label>
                <span className="label-text">账号名称</span>
                <input value={credentials.accountName} onChange={(event) => setCredentials({ ...credentials, accountName: event.target.value })} />
              </label>
              <button type="submit" className="submit-button">保存凭证</button>
            </div>
          </form>
        ) : null}

        {activeTab === 'debug' ? <DebugView /> : null}
        {activeTab === 'detailed-debug' ? <DetailedDebugView /> : null}

        {activeMainView ? (
          <>
            <ViewSummaryCards items={visibleSummaryCards} />

            {activeMainView === 'timeline' ? (
              <>
                {panelState.timeline.modules ? (
                  <ModuleConfigurator
                    modules={defaultModules.timeline.map((module) => ({ ...module }))}
                    visibility={moduleVisibility}
                    onToggle={toggleModuleVisibility}
                    onMove={(key, direction) => moveModule('timeline', key, direction)}
                  />
                ) : null}
                <div className="data-actions top-actions">
                  <button className={`action-button ${panelState.timeline.modules ? 'active' : ''}`} onClick={() => togglePanel('modules')}>
                    模块配置
                  </button>
                </div>
              <TimelinePanel
                scheduleRuns={timelineData.scheduleRuns}
                historyItems={timelineData.history}
                selectedDate={selectedTimelineDate}
                selectedMachine={selectedTimelineMachine}
                machineOptions={timelineMachineOptions}
                globalSummary={timelineData.globalSummary}
                localSummary={timelineData.localSummary}
                onDateChange={setSelectedTimelineDate}
                onMachineChange={setSelectedTimelineMachine}
                onOpenLogs={handleTimelineLogClick}
                />
              </>
            ) : (
              <DataTablePanel
                viewKey={activeMainView}
                columns={currentColumns}
                data={processedRows}
                filterSourceData={dashboardData[activeMainView]}
                filters={filtersByView[activeMainView]}
                sortConfig={sortByView[activeMainView]}
                showFilters={panelState[activeMainView].filters}
                showColumns={panelState[activeMainView].columns}
                showModules={panelState[activeMainView].modules}
                onToggleFilters={() => togglePanel('filters')}
                onToggleColumns={() => togglePanel('columns')}
                onToggleModules={() => togglePanel('modules')}
                onFilterChange={handleFilterChange}
                onResetFilters={resetFilters}
                onSort={handleSort}
                onColumnVisibilityChange={updateColumnVisibility}
                onRowClick={handleRowClick}
                renderCellValue={renderCellValue}
                moduleConfigurator={
                  <ModuleConfigurator
                    modules={moduleOrder[activeMainView]
                      .map((key) => defaultModules[activeMainView].find((module) => module.key === key))
                      .filter(Boolean) as any}
                    visibility={moduleVisibility}
                    onToggle={toggleModuleVisibility}
                    onMove={(key, direction) => moveModule(activeMainView, key, direction)}
                  />
                }
              />
            )}
          </>
        ) : null}
      </main>

      <DetailDrawer
        open={drawerOpen}
        title={getDrawerTitle()}
        subtitle={getDrawerSubtitle()}
        sections={drawerSections}
        onClose={() => setDrawerOpen(false)}
        loading={drawerLoading}
      />
      <DetailDrawer
        open={logDrawerOpen}
        title={logDrawerTitle}
        subtitle="应用运行日志"
        sections={logDrawerSections}
        onClose={() => setLogDrawerOpen(false)}
        loading={drawerLoading}
      />
    </div>
  );
}

export default App;
