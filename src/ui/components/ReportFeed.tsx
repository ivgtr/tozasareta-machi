import type { Effect } from '../../game/types'

const TARGET_LABEL: Record<string, string> = {
  food: '食料',
  power: '電力',
  medical: '医療',
  morale: '士気',
  budget: '予算',
  stockpile: '備蓄',
}

export function ReportFeed({ report }: { report: Effect[] }) {
  if (report.length === 0) {
    return <p className="report__empty">まだ記録はない。最初の一日を始めよう。</p>
  }
  const day = report[0]?.day ?? 1
  return (
    <div className="report">
      <p className="report__day">── 第{day}日 ──</p>
      <ul className="report__list">
        {report.map((e, i) => (
          <li key={i} className="report__line">
            <span className="report__reason">{e.reason}</span>
            {e.target.startsWith('flag:') ? null : (
              <span
                className={`report__delta ${e.delta >= 0 ? 'report__delta--up' : 'report__delta--down'}`}
              >
                {TARGET_LABEL[e.target] ?? e.target} {e.delta >= 0 ? '+' : ''}
                {e.delta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
