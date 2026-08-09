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
