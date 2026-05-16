export type StatusTone = 'success' | 'warning' | 'danger';

export function getStatusTone(value: string): StatusTone {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes('fail') ||
    lower.includes('error') ||
    lower.includes('offline') ||
    lower.includes('stop') ||
    lower.includes('cancel') ||
    lower.includes('terminate') ||
    raw.includes('异常') ||
    raw.includes('失败') ||
    raw.includes('离线') ||
    raw.includes('已停止') ||
    raw.includes('已取消') ||
    raw.includes('已终止')
  ) {
    return 'danger';
  }

  if (
    lower.includes('run') ||
    lower.includes('wait') ||
    lower.includes('queue') ||
    raw.includes('执行中') ||
    raw.includes('运行中') ||
    raw.includes('等待') ||
    raw.includes('调度中') ||
    raw.includes('处理中') ||
    raw.includes('禁用')
  ) {
    return 'warning';
  }

  return 'success';
}
