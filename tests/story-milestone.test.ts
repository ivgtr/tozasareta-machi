import { describe, expect, it } from 'vitest'
import { BALANCE } from '../src/game/data/balance'
import {
  advanceStoryMilestone,
  createStoryMilestoneSession,
  storyMilestoneView,
} from '../src/scene/story/milestone-model'
import { buildStoryMilestoneFixture } from '../src/scene/testing/story-milestone-fixtures'

describe('story milestone', () => {
  it('defines the prologue as a deterministic three-page presentation contract', () => {
    const first = buildStoryMilestoneFixture('prologue')
    const second = buildStoryMilestoneFixture('prologue')

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      pageNumber: 1,
      pageCount: 3,
      isLast: false,
      spec: { completeLabel: 'DAY 1へ ▶' },
      page: { title: '町は孤立した' },
    })
  })

  it('derives the rescue horizon from BALANCE instead of duplicating the day count', () => {
    const first = createStoryMilestoneSession('prologue')
    const second = advanceStoryMilestone(first)
    expect(second).not.toBeNull()
    expect(storyMilestoneView(second!).page.title).toBe(`救援まで ${BALANCE.days} 日`)
    expect(storyMilestoneView(second!).page.body).toContain(`${BALANCE.days} 日`)
  })

  it('defines both Act transitions from BALANCE as one-page milestones', () => {
    const stalemate = buildStoryMilestoneFixture('act_stalemate')
    expect(stalemate).toMatchObject({
      pageCount: 1,
      isLast: true,
      spec: { completeLabel: '計画へ ▶' },
      page: {
        kicker: `ACT II / 膠着 / DAY ${BALANCE.acts.stalemate.start}`,
        ruleNote: `ルール変更：電力劣化 ×${BALANCE.acts.stalemate.powerDecayMult.toFixed(2)}`,
      },
    })

    const final = buildStoryMilestoneFixture('act_final')
    const remaining = BALANCE.days - BALANCE.acts.final.start + 1
    expect(final).toMatchObject({
      pageCount: 1,
      isLast: true,
      spec: { completeLabel: '計画へ ▶' },
      page: {
        kicker: `ACT III / 正念場 / DAY ${BALANCE.acts.final.start}`,
        title: `救援まで残り ${remaining} 日`,
        ruleNote: `ルール変更：電力劣化 ×${BALANCE.acts.final.powerDecayMult.toFixed(2)} / 医療消耗 ×${BALANCE.acts.final.medicalDecayMult.toFixed(2)} / 収入 ×${BALANCE.acts.final.incomeMult.toFixed(2)}`,
      },
    })
  })

  it('advances without mutating the session and ends after the final page', () => {
    const first = createStoryMilestoneSession('prologue')
    const second = advanceStoryMilestone(first)
    const third = second ? advanceStoryMilestone(second) : null
    const done = third ? advanceStoryMilestone(third) : null

    expect(first).toEqual({ id: 'prologue', pageIndex: 0 })
    expect(second).toEqual({ id: 'prologue', pageIndex: 1 })
    expect(third).toEqual({ id: 'prologue', pageIndex: 2 })
    expect(third && storyMilestoneView(third).isLast).toBe(true)
    expect(done).toBeNull()
  })
})
