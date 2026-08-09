import { BALANCE } from '../../game/data/balance'
import type { ArtKind } from '../art/manifest'

export type StoryMilestoneId = 'prologue' | 'act_stalemate' | 'act_final' | 'rescue_near'

export interface StoryArtRef {
  kind: Extract<ArtKind, 'event' | 'portrait' | 'scene'>
  id: string
  fallbackGlyph?: string
}

export interface StorySpeaker {
  name: string
  role: string
}

export interface StoryPage {
  kicker: string
  title: string
  body: string
  art: StoryArtRef
  speaker?: StorySpeaker
  ruleNote?: string
}

export interface StoryMilestoneSpec {
  id: StoryMilestoneId
  pages: readonly StoryPage[]
}

export interface StoryMilestoneSession {
  id: StoryMilestoneId
  pageIndex: number
}

export interface StoryMilestoneView {
  spec: StoryMilestoneSpec
  page: StoryPage
  pageIndex: number
  pageNumber: number
  pageCount: number
  isLast: boolean
}

const MILESTONES: Partial<Record<StoryMilestoneId, StoryMilestoneSpec>> = {
  prologue: {
    id: 'prologue',
    pages: [
      {
        kicker: 'PROLOGUE / 災害発生',
        title: '町は孤立した',
        body: '昨夜の豪雨で、唯一の幹線道路が崩落した。\n送電と通信も不安定になり、外部との往来は途絶えている。',
        art: { kind: 'event', id: 'road_collapse', fallbackGlyph: '雨' },
      },
      {
        kicker: '緊急災害対策本部',
        title: `救援まで ${BALANCE.days} 日`,
        body: `本格的な救援が到着できるのは ${BALANCE.days} 日後です。\nそれまでは、町に残った人員と物資だけで持たせるしかありません。`,
        art: { kind: 'portrait', id: 'mayor', fallbackGlyph: '長' },
        speaker: { name: '真壁史子', role: '町長' },
      },
      {
        kicker: 'DAY 1 / 指揮引き継ぎ',
        title: '指揮を引き継ぐ',
        body: '今日から、現場の配置と物資配分をあなたに任せます。\nそれまで、この町を持たせなければなりません。',
        art: { kind: 'portrait', id: 'mayor', fallbackGlyph: '長' },
        speaker: { name: '真壁史子', role: '町長' },
      },
    ],
  },
}

export function storyMilestone(id: StoryMilestoneId): StoryMilestoneSpec {
  const milestone = MILESTONES[id]
  if (!milestone) throw new Error(`Story milestone is not implemented: ${id}`)
  return milestone
}

export function createStoryMilestoneSession(id: StoryMilestoneId): StoryMilestoneSession {
  storyMilestone(id)
  return { id, pageIndex: 0 }
}

export function storyMilestoneView(session: StoryMilestoneSession): StoryMilestoneView {
  const spec = storyMilestone(session.id)
  const page = spec.pages[session.pageIndex]
  if (!page) {
    throw new Error(`Story milestone page is out of range: ${session.id}:${session.pageIndex}`)
  }
  return {
    spec,
    page,
    pageIndex: session.pageIndex,
    pageNumber: session.pageIndex + 1,
    pageCount: spec.pages.length,
    isLast: session.pageIndex === spec.pages.length - 1,
  }
}

export function advanceStoryMilestone(
  session: StoryMilestoneSession,
): StoryMilestoneSession | null {
  const spec = storyMilestone(session.id)
  const nextPageIndex = session.pageIndex + 1
  return nextPageIndex < spec.pages.length ? { ...session, pageIndex: nextPageIndex } : null
}
