import type { SummaryCardItem } from '../types';

interface ViewSummaryCardsProps {
  items: SummaryCardItem[];
}

function ViewSummaryCards({ items }: ViewSummaryCardsProps) {
  return (
    <section className="summary-grid">
      {items.map((item) => (
        <article key={item.key} className={`summary-card tone-${item.tone || 'default'}`}>
          <div className="summary-card__label">{item.label}</div>
          <div className="summary-card__value">{item.value}</div>
          {item.helper ? <div className="summary-card__helper">{item.helper}</div> : null}
        </article>
      ))}
    </section>
  );
}

export default ViewSummaryCards;
