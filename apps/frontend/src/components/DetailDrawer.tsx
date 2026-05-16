import type { DrawerSection } from '../types';

interface DetailDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  sections: DrawerSection[];
  onClose: () => void;
  loading?: boolean;
}

function DetailDrawer({ open, title, subtitle, sections, onClose, loading }: DetailDrawerProps) {
  return (
    <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose}>
      <aside className={`detail-drawer ${open ? 'open' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="detail-drawer__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>
            关闭
          </button>
        </div>

        {loading ? <div className="drawer-loading">加载详情数据...</div> : null}

        <div className="detail-drawer__content">
          {sections.map((section) => (
            <section key={section.title} className="drawer-section">
              <h3>{section.title}</h3>
              {section.fields ? (
                <div className="drawer-field-grid">
                  {section.fields.map((field) => (
                    <div key={`${section.title}-${field.label}`} className="drawer-field">
                      <span>{field.label}</span>
                      <strong>{field.value ?? '无'}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              {section.list ? (
                <ul className="drawer-list">
                  {section.list.map((item) => (
                    <li key={`${section.title}-${item}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.notice ? <p className="drawer-notice">{section.notice}</p> : null}
              {section.timeline ? (
                <div className="drawer-timeline">
                  {section.timeline.map((item, index) => (
                    <div key={`${section.title}-${index}`} className={`timeline-event tone-${item.tone || 'default'}`}>
                      <span className="timeline-event__status">{item.tone === 'danger' ? '异常' : item.tone === 'warning' ? '运行' : '完成'}</span>
                      <strong>{item.title}</strong>
                      {item.meta ? <time>{item.meta}</time> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {section.logs ? (
                <div className="drawer-log-list">
                  {section.logs.length ? section.logs.map((log, index) => (
                    <article key={`${section.title}-${log.logId || index}`} className="drawer-log-entry">
                      <div className="drawer-log-head">
                        <span className={`drawer-log-level ${String(log.level || '').includes('错') ? 'danger' : ''}`}>
                          {log.level || '日志'}
                        </span>
                        <time>{log.time || '无时间'}</time>
                        {log.logId ? <small>#{log.logId}</small> : null}
                      </div>
                      <pre>{log.text || '无内容'}</pre>
                    </article>
                  )) : <p className="drawer-notice">暂无日志内容</p>}
                </div>
              ) : null}
              {section.raw?.length ? (
                <details className="drawer-raw-details">
                  <summary>原始数据</summary>
                  <pre className="drawer-raw">{JSON.stringify(section.raw, null, 2)}</pre>
                </details>
              ) : null}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default DetailDrawer;
