import * as XLSX from 'xlsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColumnConfig, FilterConfig, MainViewKey, SortConfig } from '../types';

interface DataTablePanelProps {
  viewKey: MainViewKey;
  columns: ColumnConfig[];
  data: any[];
  filterSourceData?: any[];
  filters: FilterConfig;
  sortConfig: SortConfig;
  showFilters: boolean;
  showColumns: boolean;
  showModules: boolean;
  onToggleFilters: () => void;
  onToggleColumns: () => void;
  onToggleModules: () => void;
  onFilterChange: (key: string, value: string[]) => void;
  onResetFilters: () => void;
  onSort: (column: string) => void;
  onColumnVisibilityChange: (key: string, visible: boolean) => void;
  onRowClick: (item: any) => void;
  renderCellValue: (item: any, key: string) => ReactNode;
  moduleConfigurator?: ReactNode;
}

function DataTablePanel(props: DataTablePanelProps) {
  const {
    viewKey,
    columns,
    data,
    filterSourceData,
    filters,
    sortConfig,
    showFilters,
    showColumns,
    showModules,
    onToggleFilters,
    onToggleColumns,
    onToggleModules,
    onFilterChange,
    onResetFilters,
    onSort,
    onColumnVisibilityChange,
    onRowClick,
    renderCellValue,
    moduleConfigurator,
  } = props;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [openFilterKey, setOpenFilterKey] = useState('');
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  const sourceData = filterSourceData || data;
  const activeFilterCount = Object.values(filters).reduce((total, value) => total + value.length, 0);
  const filterOptions = useMemo(() => {
    const result: Record<string, string[]> = {};
    columns.filter((col) => col.filterable).forEach((col) => {
      const values = sourceData.flatMap((item) => {
        const value = item[col.key];
        if (Array.isArray(value)) return value.filter(Boolean).map(String);
        if (value === null || value === undefined || value === '') return [];
        return [String(value)];
      });
      result[col.key] = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 300);
    });
    return result;
  }, [columns, sourceData]);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pageSize, safePage]);

  useEffect(() => {
    setPage(1);
  }, [viewKey, filters, sortConfig, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!filterBarRef.current?.contains(event.target as Node)) {
        setOpenFilterKey('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    setOpenFilterKey('');
  }, [viewKey, showFilters]);

  function exportExcel() {
    if (!data.length) {
      return;
    }

    const visibleColumns = columns.filter((col) => col.visible);
    const exportData = data.map((item) =>
      Object.fromEntries(visibleColumns.map((col) => [col.label, item[col.key] ?? ''])),
    );

    const sheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, viewKey);
    XLSX.writeFile(workbook, `yingdao-${viewKey}-${new Date().toISOString().slice(0, 19)}.xlsx`);
  }

  function toggleFilterValue(key: string, value: string) {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onFilterChange(key, next);
  }

  return (
    <section className="data-panel">
      <div className="table-toolbar">
        <div className="data-actions">
          <button className={`action-button ${showFilters ? 'active' : ''}`} onClick={onToggleFilters}>筛选</button>
          <button className={`action-button ${showColumns ? 'active' : ''}`} onClick={onToggleColumns}>字段</button>
          <button className={`action-button ${showModules ? 'active' : ''}`} onClick={onToggleModules}>模块</button>
          <button className="action-button" onClick={exportExcel}>导出Excel</button>
        </div>
        <div className="table-meta">
          <span>共 {data.length} 条</span>
          <label>
            每页
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
        </div>
      </div>

      {showFilters ? (
        <div className="filter-select-bar" ref={filterBarRef}>
          <span className="filter-select-title">筛选</span>
          {columns.filter((col) => col.filterable).map((col) => {
            const searchText = filterSearch[col.key] || '';
            const options = (filterOptions[col.key] || []).filter((value) =>
              value.toLowerCase().includes(searchText.trim().toLowerCase()),
            );
            const selectedCount = filters[col.key]?.length || 0;

            return (
              <div key={col.key} className={`filter-multi-select ${openFilterKey === col.key ? 'open' : ''}`}>
                <button
                  type="button"
                  className="filter-trigger"
                  onClick={() => setOpenFilterKey((current) => (current === col.key ? '' : col.key))}
                >
                  <span>{col.label}</span>
                  <strong>{selectedCount ? `${selectedCount}项` : '全部'}</strong>
                </button>
                {openFilterKey === col.key ? (
                  <div className="filter-menu">
                    <input
                      className="filter-search-input"
                      value={searchText}
                      placeholder={`搜索${col.label}`}
                      autoFocus
                      onChange={(event) => setFilterSearch((prev) => ({ ...prev, [col.key]: event.target.value }))}
                    />
                    <div className="filter-menu-actions">
                      <button type="button" className="filter-clear" onClick={() => onFilterChange(col.key, [])}>全部</button>
                      <button type="button" className="filter-done" onClick={() => setOpenFilterKey('')}>完成</button>
                    </div>
                    <div className="filter-option-list">
                      {options.length ? options.map((value) => (
                        <label key={`${col.key}-${value}`} className="filter-option">
                          <input
                            type="checkbox"
                            checked={(filters[col.key] || []).includes(value)}
                            onChange={() => toggleFilterValue(col.key, value)}
                          />
                          <span>{value}</span>
                        </label>
                      )) : <div className="filter-no-options">没有匹配选项</div>}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          <button className="reset-filter-button" onClick={onResetFilters}>重置</button>
        </div>
      ) : null}

      {sortConfig.rules?.length ? (
        <div className="sort-rule-bar">
          <span>排序</span>
          {sortConfig.rules.map((rule, index) => {
            const column = columns.find((item) => item.key === rule.column);
            return (
              <button key={rule.column} type="button" className="sort-rule-chip" onClick={() => onSort(rule.column)}>
                {index + 1}. {column?.label || rule.column} {rule.direction === 'asc' ? '升序' : '降序'}
              </button>
            );
          })}
        </div>
      ) : null}

      {showColumns ? (
        <div className="columns-panel">
          <h3>显示字段</h3>
          <div className="columns-grid">
            {columns.map((col) => (
              <label key={col.key} className="column-checkbox">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={(event) => onColumnVisibilityChange(col.key, event.target.checked)}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {showModules ? moduleConfigurator : null}

      <div className="table-wrapper">
        {data.length === 0 ? (
          <div className={activeFilterCount > 0 ? 'empty-result' : 'empty-state'}>
            {activeFilterCount > 0 ? '没有匹配的记录' : '暂无数据'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.filter((col) => col.visible).map((col) => (
                  <th key={col.key}>
                    {col.sortable ? (
                      <button className="sortable-header" onClick={() => onSort(col.key)}>
                        {col.label}
                        {(() => {
                          const rules = sortConfig.rules?.length
                            ? sortConfig.rules
                            : sortConfig.direction && sortConfig.column
                              ? [{ column: sortConfig.column, direction: sortConfig.direction }]
                              : [];
                          const ruleIndex = rules.findIndex((rule) => rule.column === col.key);
                          const rule = ruleIndex >= 0 ? rules[ruleIndex] : null;
                          return rule ? (
                            <span className="sort-indicator">
                              {rule.direction === 'asc' ? '↑' : '↓'}
                              {rules.length > 1 ? ruleIndex + 1 : ''}
                            </span>
                          ) : null;
                        })()}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((item) => (
                <tr key={item.id || item.scheduleUuid || item.robotUuid} className="data-row" onClick={() => onRowClick(item)}>
                  {columns.filter((col) => col.visible).map((col) => (
                    <td key={col.key} className={`cell-${col.key}`}>
                      {renderCellValue(item, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.length > 0 ? (
        <div className="pagination-bar">
          <span>
            第 {safePage} / {totalPages} 页，显示 {(safePage - 1) * pageSize + 1}-
            {Math.min(safePage * pageSize, data.length)} 条
          </span>
          <div className="pagination-actions">
            <button className="mini-button" disabled={safePage === 1} onClick={() => setPage(1)}>首页</button>
            <button className="mini-button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button>
            <button className="mini-button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</button>
            <button className="mini-button" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>末页</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default DataTablePanel;
