import { describe, expect, it } from 'vitest'
import { visibleLogEntries } from '../src/scene/log-drawer-model'
import type { Effect } from '../src/game/types'

function makeReport(count: number): Effect[] {
  return Array.from({ length: count }, (_, index) => ({
    day: 1,
    source: 'test',
    target: 'food',
    delta: index,
    reason: `entry-${index}`,
  }))
}

describe('visibleLogEntries', () => {
  it('折りたたみ時は最新3件だけを返す', () => {
    const visible = visibleLogEntries(makeReport(15), false)
    expect(visible.map((entry) => entry.reason)).toEqual(['entry-12', 'entry-13', 'entry-14'])
  })

  it('展開時は最新12件だけを返す', () => {
    const visible = visibleLogEntries(makeReport(15), true)
    expect(visible.map((entry) => entry.reason)).toEqual(
      Array.from({ length: 12 }, (_, index) => `entry-${index + 3}`),
    )
  })

  it('上限未満の履歴は先頭を落とさない', () => {
    const report = makeReport(2)
    expect(visibleLogEntries(report, false)).toEqual(report)
    expect(visibleLogEntries(report, true)).toEqual(report)
  })
})
