import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineAppRunItem, TimelineItem } from '../types';
import { getStatusTone } from '../utils/statusTone';

interface TimelinePanelProps {
  scheduleRuns: TimelineAppRunItem[];
  historyItems: TimelineItem[];
  selectedDate: string;
  selectedMachine: string;
  machineOptions: string[];
  globalSummary: {
    scheduleCount: number;
    hourCount: number;
    appCount: number;
    machineCount: number;
    historyCount: number;
    failureCount: number;
    runnableLogCount: number;
  };
  localSummary: {
    scheduleCount: number;
    appCount: number;
    machineCount: number;
  };
  onDateChange: (value: string) => void;
  onMachineChange: (value: string) => void;
  onOpenLogs?: (item: TimelineItem) => void;
}

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateTitle(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' });
}

function getTimeValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getHourLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${String(Number(value.slice(11, 13)) || 0).padStart(2, '0')}:00`;
  }
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function buildHourSlots(runs: TimelineAppRunItem[]) {
  const groups = new Map<string, TimelineAppRunItem[]>();
  Array.from({ length: 24 }).forEach((_, hour) => {
    groups.set(`${String(hour).padStart(2, '0')}:00`, []);
  });
  runs.forEach((run) => {
    const key = getHourLabel(run.executionTime);
    groups.set(key, [...(groups.get(key) || []), run]);
  });
  return Array.from(groups.entries());
}


function splitDisplayValues(value: string) {
  return value
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderCompactTags(value: string, emptyLabel: string) {
  const items = splitDisplayValues(value);
  if (!items.length) return <span className="compact-app-empty">{emptyLabel}</span>;
  return (
    <div className="compact-app-list" title={items.join(' / ')}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="compact-app-item">{item}</span>
      ))}
    </div>
  );
}

function clampHourIndex(value: number) {
  return Math.max(0, Math.min(23, value));
}

function TimelinePanel({
  scheduleRuns,
  historyItems,
  selectedDate,
  selectedMachine,
  machineOptions,
  globalSummary,
  localSummary,
  onDateChange,
  onMachineChange,
  onOpenLogs,
}: TimelinePanelProps) {
  const [activeSection, setActiveSection] = useState<'schedule' | 'history'>('schedule');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [activeHour, setActiveHour] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; hour: number } | null>(null);
  const selectedDateTitle = getDateTitle(selectedDate);
  const inlineControlsRef = useRef<HTMLDivElement | null>(null);
  const hourSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const railRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const sortedScheduleRuns = useMemo(
    () => [...scheduleRuns].sort((a, b) => getTimeValue(a.executionTime) - getTimeValue(b.executionTime)),
    [scheduleRuns],
  );
  const hourSlots = useMemo(() => buildHourSlots(sortedScheduleRuns), [sortedScheduleRuns]);

  useEffect(() => {
    if (activeSection !== 'schedule') return;

    const updateActiveHour = () => {
      const entries = hourSlots
        .map(([hour]) => {
          const element = hourSectionRefs.current[hour];
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { hour, top: rect.top, bottom: rect.bottom };
        })
        .filter(Boolean) as Array<{ hour: string; top: number; bottom: number }>;

      if (!entries.length) return;

      const anchor = 170;
      const current =
        entries.find((entry) => entry.top <= anchor && entry.bottom > anchor) ||
        entries.find((entry) => entry.top > anchor) ||
        entries[entries.length - 1];

      setActiveHour(clampHourIndex(Number(current.hour.slice(0, 2))));
    };

    updateActiveHour();
    window.addEventListener('scroll', updateActiveHour, { passive: true });
    window.addEventListener('resize', updateActiveHour);
    return () => {
      window.removeEventListener('scroll', updateActiveHour);
      window.removeEventListener('resize', updateActiveHour);
    };
  }, [activeSection, hourSlots]);

  function scrollToHour(hourIndex: number) {
    const hourLabel = `${String(hourIndex).padStart(2, '0')}:00`;
    const target = hourSectionRefs.current[hourLabel];
    if (!target) return;
    setActiveHour(hourIndex);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getHourFromRailEvent(clientY: number) {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const hourIndex = Math.floor((relativeY / rect.height) * 24);
    return clampHourIndex(hourIndex);
  }

  function updateTooltip(clientX: number, clientY: number, hour: number) {
    setTooltip({
      x: clientX + 14,
      y: clientY + 14,
      hour,
    });
  }

  function handleRailPointer(clientX: number, clientY: number, shouldScroll = false) {
    const hour = getHourFromRailEvent(clientY);
    setHoveredHour(hour);
    updateTooltip(clientX, clientY, hour);
    if (shouldScroll) {
      scrollToHour(hour);
    }
  }

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      if (!isDraggingRef.current) return;
      handleRailPointer(event.clientX, event.clientY, true);
    }

    function handlePointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const target = inlineControlsRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingControls(!entry.isIntersecting);
      },
      {
        threshold: 0.2,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="daily-schedule-layout">
      <div className="timeline-workspace data-panel compact-panel">
        <div className="panel-heading">
          <div className="timeline-toolbar__copy">
            <h3>时间视图</h3>
            <p>{selectedDateTitle}</p>
          </div>
          <div ref={inlineControlsRef} className="schedule-date-controls timeline-inline-controls">
            <button type="button" className="mini-button" onClick={() => onDateChange(toDateInputValue())}>今天</button>
            <input type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
            <select value={selectedMachine} onChange={(event) => onMachineChange(event.target.value)}>
              <option value="all">全部机器</option>
              {machineOptions.map((machine) => (
                <option key={machine} value={machine}>{machine}</option>
              ))}
            </select>
          </div>
          <div className={`timeline-floating-controls ${showFloatingControls ? 'visible' : ''}`}>
            <button
              type="button"
              className={`timeline-floating-toggle ${controlsOpen ? 'open' : ''}`}
              onClick={() => setControlsOpen((current) => !current)}
              aria-label="切换时间视图筛选"
            >
              筛选
            </button>
            <div className={`timeline-floating-panel ${controlsOpen ? 'open' : ''}`}>
              <div className="timeline-floating-panel__head">
                <strong>时间与机器</strong>
                <button type="button" className="timeline-floating-close" onClick={() => setControlsOpen(false)}>
                  收起
                </button>
              </div>
              <div className="schedule-date-controls timeline-floating-panel__controls">
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => onDateChange(toDateInputValue())}
                >
                  今天
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => onDateChange(event.target.value)}
                />
                <select value={selectedMachine} onChange={(event) => onMachineChange(event.target.value)}>
                  <option value="all">全部机器</option>
                  {machineOptions.map((machine) => (
                    <option key={machine} value={machine}>{machine}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="timeline-kpi-strip">
          <div className="timeline-kpi-card">
            <span>全局日程条目</span>
            <strong>{globalSummary.scheduleCount}</strong>
          </div>
          <div className="timeline-kpi-card">
            <span>全局涉及小时</span>
            <strong>{globalSummary.hourCount}</strong>
          </div>
          <div className="timeline-kpi-card">
            <span>全局涉及应用</span>
            <strong>{globalSummary.appCount}</strong>
          </div>
          <div className="timeline-kpi-card danger">
            <span>全局异常记录</span>
            <strong>{globalSummary.failureCount}</strong>
          </div>
        </div>
        <div className="timeline-section-tabs">
          <button
            type="button"
            className={`timeline-section-tab ${activeSection === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveSection('schedule')}
          >
            日程表
          </button>
          <button
            type="button"
            className={`timeline-section-tab ${activeSection === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSection('history')}
          >
            历史日志
          </button>
        </div>

        {activeSection === 'schedule' ? (
          <div className="timeline-section-card daily-schedule">
            <div className="timeline-section-head">
              <div>
                <h4>今日应用执行表</h4>
                <p>按 00-23 点展示当天已执行应用和未来计划。顶部为全局摘要，当前内容{selectedMachine === 'all' ? '显示全部机器' : `仅显示 ${selectedMachine}`}。</p>
              </div>
            </div>
            <div className="schedule-summary-bar">
              <div className="schedule-summary-item">
                <span>当前日程条数</span>
                <strong>{localSummary.scheduleCount}</strong>
              </div>
              <div className="schedule-summary-item">
                <span>当前应用数</span>
                <strong>{localSummary.appCount}</strong>
              </div>
              <div className="schedule-summary-item">
                <span>当前机器数</span>
                <strong>{localSummary.machineCount}</strong>
              </div>
            </div>
            <div className="schedule-ledger-shell">
              <div
                ref={railRef}
                className="schedule-time-rail"
                onMouseMove={(event) => handleRailPointer(event.clientX, event.clientY, false)}
                onMouseLeave={() => {
                  if (!isDraggingRef.current) {
                    setHoveredHour(null);
                    setTooltip(null);
                  }
                }}
                onMouseDown={(event) => {
                  isDraggingRef.current = true;
                  handleRailPointer(event.clientX, event.clientY, true);
                }}
              >
                <div className="schedule-time-rail__track" />
                {Array.from({ length: 24 }).map((_, hour) => {
                  const top = `${(hour / 23) * 100}%`;
                  const isActive = activeHour === hour;
                  const isHovered = hoveredHour === hour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      className={`schedule-time-rail__mark ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                      style={{ top }}
                      onClick={() => scrollToHour(hour)}
                      onMouseEnter={(event) => {
                        setHoveredHour(hour);
                        updateTooltip(event.clientX, event.clientY, hour);
                      }}
                      onMouseMove={(event) => updateTooltip(event.clientX, event.clientY, hour)}
                    >
                      <span>{String(hour).padStart(2, '0')}</span>
                    </button>
                  );
                })}
              </div>
              <div className="schedule-ledger">
                <div className="schedule-ledger-head schedule-ledger-head--runs">
                  <span>时间</span>
                  <span>应用</span>
                  <span>任务</span>
                  <span>机器</span>
                  <span>状态</span>
                  <span>运行时长</span>
                </div>
                <div className="schedule-ledger-body">
                  {hourSlots.map(([hour, items]) => (
                    <section
                      key={hour}
                      className="schedule-cluster"
                      ref={(node) => {
                        hourSectionRefs.current[hour] = node;
                      }}
                    >
                      <div className="schedule-cluster-time">
                        <strong>{hour}</strong>
                        <small>{items.length} 条</small>
                      </div>
                      <div className="schedule-cluster-rows">
                        {items.length === 0 ? (
                          <article className="schedule-ledger-row schedule-ledger-row--empty">
                            <div className="schedule-ledger-empty">该时段无应用执行</div>
                          </article>
                        ) : (
                          (() => {
                            const futureItems = items.filter((item) => item.sourceType === 'future');
                            const historyItems = items.filter((item) => item.sourceType === 'history');
                            const groups = [
                              { key: 'future', label: '计划时点', entries: futureItems },
                              { key: 'history', label: '已执行', entries: historyItems },
                            ].filter((group) => group.entries.length > 0);

                            return groups.map((group) => (
                              <div key={group.key} className="schedule-subgroup">
                                <div className="schedule-subgroup-label">{group.label}</div>
                                <div className="schedule-subgroup-rows">
                                  {group.entries.map((item) => {
                                    const tone = getStatusTone(item.status);
                                    return (
                                      <article key={item.id} className={`schedule-ledger-row tone-${tone}`}>
                                        <div className="schedule-ledger-appname">
                                          <div className="schedule-ledger-appchips">{renderCompactTags(item.appName, '无关联应用')}</div>
                                          <p>{item.sourceType === 'future' ? `计划时间：${item.executionTime}` : `执行时间：${item.executionTime}`}</p>
                                        </div>
                                        <div className="schedule-ledger-task">
                                          <strong>{item.relatedTaskNames.join(' / ') || '无关联任务'}</strong>
                                        </div>
                                        <div className="schedule-ledger-machine">{item.relatedMachineNames.join(' / ') || '无关联机器'}</div>
                                        <div className="schedule-ledger-status">
                                          <div className="schedule-status-stack">
                                            <span className={`schedule-status tone-${tone}`}>{item.status}</span>
                                            <span className="schedule-status-note">{item.sourceType === 'future' ? '计划时点' : '已执行'}</span>
                                          </div>
                                        </div>
                                        <div className="schedule-ledger-duration">{item.executionDuration || '--'}</div>
                                      </article>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
              {tooltip ? (
                <div
                  className="schedule-time-rail__tooltip"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  {String(tooltip.hour).padStart(2, '0')}:00
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="timeline-section-card">
            <div className="timeline-section-head">
              <div>
                <h4>历史日志</h4>
                <p>仅展示当日历史执行，支持按机器排查，并补充本次运行时长。</p>
              </div>
            </div>
            <div className="history-log-table">
              <div className="history-log-head">
                <span>时间</span>
                <span>应用 / 任务</span>
                <span>机器</span>
                <span>状态</span>
                <span>运行时长</span>
                <span>操作</span>
              </div>
              <div className="timeline-axis">
                {historyItems.length === 0 ? <div className="empty-state small">暂无历史执行</div> : null}
                {historyItems.map((item) => (
                  <article key={item.id} className={`timeline-axis-item ${getStatusTone(item.status) === 'danger' ? 'is-danger' : ''}`}>
                    <span className="history-log-time">{item.executionTime.split(' ').slice(1).join(' ') || item.executionTime}</span>
                    <div className="history-log-main">
                      <div className="history-log-tags">{renderCompactTags(item.appName || '', '无关联应用')}</div>
                      <p>{item.taskName}</p>
                    </div>
                    <span className="history-log-machine">{item.machineName}</span>
                    <span className={`history-log-status tone-${getStatusTone(item.status)}`}>{item.status}</span>
                    <span className="history-log-duration">{item.executionDuration || '无'}</span>
                    <button
                      type="button"
                      className="mini-button timeline-log-button"
                      disabled={!item.logAvailable}
                      onClick={() => onOpenLogs?.(item)}
                    >
                      查看日志
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default TimelinePanel;
