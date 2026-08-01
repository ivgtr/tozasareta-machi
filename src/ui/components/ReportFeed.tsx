import type { Effect } from '../../game/types'
import { TypeText } from './TypeText'

const TARGET_LABEL: Record<string, string> = {
  food: '食料',
  power: '電力',
  medical: '医療',
  morale: '士気',
  budget: '予算',
  stockpile: '備蓄',
}

export function ReportFeed({
  report,
  animateLast = false,
}: {
  report: Effect[]
  animateLast?: boolean
}) {
  if (report.length === 0) {
    return <p className="report__empty">まだ記録はない。最初の一日を始めよう。</p>
  }
  const day = report[0]?.day ?? 1
  return (
    <div className="report" role="log" aria-live="polite">
      <p className="report__day">── 第{day}日 ──</p>
      <ul className="report__list">
        {report.map((e, i) => {
          const isLast = i === report.length - 1
          return (
            <li key={`${e.source}-${i}`} className="report__line">
              <span className="report__reason">
                {animateLast && isLast ? <TypeText text={e.reason} /> : e.reason}
              </span>
              {e.target in TARGET_LABEL ? (
                <span
                  className={`report__delta ${e.delta >= 0 ? 'report__delta--up' : 'report__delta--down'}`}
                >
                  {TARGET_LABEL[e.target] ?? e.target} {e.delta >= 0 ? '+' : ''}
                  {e.delta}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
