export type MainViewKey = 'machines' | 'tasks' | 'apps' | 'timeline';
export type AppTabKey = MainViewKey | 'settings' | 'debug' | 'detailed-debug';

export interface CredentialsPayload {
  apiBaseUrl?: string;
  accessKeyId: string;
  accessKeySecret: string;
  accountName?: string;
}

export interface AppEntity {
  appId?: string;
  appName?: string;
  robotUuid: string;
  robotName: string;
  description?: string;
  createTime?: string;
  updateTime?: string;
  ownerName?: string;
  ownerAccount?: string;
  ownerId?: string;
  appType?: string;
  appTypeName?: string;
  version?: string;
  supportParam?: boolean;
  icon?: string;
}

export interface AppRunRecordEntity {
  id?: number;
  runRecordId?: string;
  appId?: string;
  userName?: string;
  startTime?: string;
  endTime?: string;
  updateTime?: string;
  runStatusName?: string;
  runStatus?: string;
  runningTime?: number;
  heartTime?: string;
  appName?: string;
  startMode?: string;
  startModeName?: string;
  remark?: string;
}

export interface TaskEntity {
  scheduleUuid: string;
  scheduleName: string;
  type: string;
  scheduleType?: string;
  enabled: boolean;
  cronExpression?: string;
  nextFireTime?: string;
  cronInterface?: {
    cronExpress?: string;
    nextTime?: string;
    type?: string;
    [key: string]: any;
  };
  robotUuid?: string;
  accountName?: string;
  createTime?: string;
}

export interface RobotEntity {
  robotClientUuid: string;
  robotClientName: string;
  status: string;
  description?: string;
  clientIp?: string;
  remark?: string;
  robotName?: string;
  accountName?: string;
  machineName?: string;
  windowsUserName?: string;
  windowsAccount?: string;
  uuid?: string;
}

export interface RobotDetailEntity {
  robotClientUuid: string;
  robotClientName: string;
  status: string;
  description?: string;
  remark?: string;
  clientIp?: string;
}

export interface TaskDetailEntity {
  taskUuid?: string;
  scheduleUuid?: string;
  uuid?: string;
  robotList?: Array<Record<string, any>>;
  robots?: Array<Record<string, any>>;
  robotClientList?: Array<Record<string, any>>;
  clients?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface ExecutionEntity {
  id?: number;
  taskUuid?: string;
  scheduleUuid?: string;
  sourceUuid?: string;
  sourceType?: string;
  status?: string;
  statusName?: string;
  result?: string;
  createTime?: string;
  updateTime?: string;
  executeTime?: string;
  startTime?: string;
  endTime?: string;
  nextFireTime?: string;
  errorMessage?: string;
  message?: string;
  taskName?: string;
  runTimes?: number;
  robotClientUuid?: string;
  robotClientName?: string;
  robotClientStatus?: string;
  currentRobotUuid?: string;
  currentRobotName?: string;
  clientIp?: string;
  description?: string;
  [key: string]: any;
}

export interface TaskProcessDetailEntity {
  jobUuid?: string;
  taskUuid?: string;
  status?: string;
  statusName?: string;
  createTime?: string;
  updateTime?: string;
  startTime?: string;
  endTime?: string;
  existsParam?: boolean;
  priority?: string;
  remark?: string;
  robotClientUuid?: string;
  robotName?: string;
  robotUuid?: string;
  screenshotUrl?: string;
  sourceType?: string;
  sourceUuid?: string;
  [key: string]: any;
}

export interface JobLogEntity {
  time?: string;
  level?: string;
  text?: string;
  logId?: number;
}

export interface JobLogSearchResult {
  requestId?: string;
  page?: {
    total?: number;
    page?: number;
    size?: number;
  };
  logs?: JobLogEntity[];
  code?: number;
  success?: boolean;
  msg?: string;
  [key: string]: any;
}

export interface RobotJobEntity {
  id?: number;
  jobUuid?: string;
  taskName?: string;
  status?: string;
  statusName?: string;
  remark?: string;
  triggerTime?: string;
  startTime?: string;
  endTime?: string;
  robotClientUuid?: string;
  robotClientName?: string;
  robotUuid?: string;
  robotName?: string;
  [key: string]: any;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  filterable: boolean;
  sortable: boolean;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc' | null;
  rules?: Array<{ column: string; direction: 'asc' | 'desc' }>;
}

export type FilterConfig = Record<string, string[]>;

export interface SummaryCardItem {
  key: string;
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  helper?: string;
}

export interface ModuleItem {
  key: string;
  title: string;
  description?: string;
}

export interface DrawerSection {
  title: string;
  fields?: Array<{ label: string; value: string | number | null | undefined }>;
  list?: string[];
  logs?: JobLogEntity[];
  timeline?: Array<{ title: string; meta?: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>;
  raw?: Array<Record<string, unknown>>;
  notice?: string;
}

export interface MachineViewRow {
  id: string;
  machineName: string;
  robotClientName: string;
  onlineStatus: string;
  currentStatus: string;
  currentTask: string;
  todayPendingCount: number;
  nextExecutionTime: string;
  latestFailure: string;
  relatedTaskCount: number;
  relatedAppCount: number;
  relatedTaskNames: string[];
  relatedAppNames: string[];
  latestExecutionStatus: string;
  latestExecutionTime: string;
  latestExecutionDuration: string;
  robot: RobotEntity;
  tasks: TaskEntity[];
  apps: AppEntity[];
  executions: ExecutionEntity[];
}

export interface TaskViewRow {
  id: string;
  scheduleUuid: string;
  scheduleName: string;
  enabledLabel: string;
  type: string;
  appName: string;
  appUuid: string;
  appUuids: string[];
  robotName: string;
  robotClientUuid: string;
  robotClientUuids: string[];
  nextExecutionTime: string;
  latestExecutionResult: string;
  latestExecutionTime: string;
  latestExecutionDuration: string;
  currentStatus: string;
  cronExpression: string;
  relatedAppNames: string[];
  relatedRobotNames: string[];
  plannedAppNames: string[];
  plannedRobotNames: string[];
  task: TaskEntity;
  app?: AppEntity;
  apps: AppEntity[];
  robot?: RobotEntity;
  robots: RobotEntity[];
  detail?: TaskDetailEntity;
  executions: ExecutionEntity[];
}

export interface AppViewRow {
  id: string;
  appId: string;
  robotUuid: string;
  appName: string;
  description: string;
  relatedTaskCount: number;
  relatedMachineCount: number;
  latestExecutionTime: string;
  latestExecutionDuration: string;
  nextExecutionTime: string;
  latestStatus: string;
  relatedTaskNames: string[];
  relatedMachineNames: string[];
  app: AppEntity;
  tasks: TaskEntity[];
  robots: RobotEntity[];
  executions: ExecutionEntity[];
  runRecords: AppRunRecordEntity[];
}


export interface TimelineAppRunItem {
  id: string;
  appName: string;
  status: string;
  executionTime: string;
  executionDuration: string;
  nextExecutionTime: string;
  relatedTaskNames: string[];
  relatedMachineNames: string[];
  sourceType: 'history' | 'future';
}

export interface TimelineItem {
  id: string;
  taskName: string;
  taskUuid: string;
  machineName: string;
  machineNames: string[];
  appName: string;
  scheduledTime: string;
  executionTime: string;
  executionDuration: string;
  status: string;
  result: string;
  type: 'future' | 'history';
  jobUuid?: string;
  robotClientUuid?: string;
  logAvailable?: boolean;
  raw?: ExecutionEntity | TaskEntity;
}

export interface DashboardBaseData {
  apps: AppEntity[];
  tasks: TaskEntity[];
  robots: RobotEntity[];
  taskDetails: TaskDetailEntity[];
  newestExecutions: ExecutionEntity[];
  appRunRecords: AppRunRecordEntity[];
}

export interface DebugSnapshot {
  request: Record<string, unknown>;
  response: unknown;
  parsed?: unknown;
  error?: string;
}

export interface ViewDataBundle {
  machines: MachineViewRow[];
  tasks: TaskViewRow[];
  apps: AppViewRow[];
  timeline: TimelineItem[];
  summary: Record<MainViewKey, SummaryCardItem[]>;
  drawerSections: Record<string, DrawerSection[]>;
  executionMap: Record<string, ExecutionEntity[]>;
}
