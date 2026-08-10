import { BALANCE } from '../../game/data/balance'
import type { ArtKind } from '../art/manifest'

export const PLAY_STORY_MILESTONE_IDS = ['act_stalemate', 'act_final', 'rescue_near'] as const

export type PlayStoryMilestoneId = (typeof PLAY_STORY_MILESTONE_IDS)[number]
export type StoryMilestoneId = 'prologue' | PlayStoryMilestoneId

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
  completeLabel: string
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

const stalemateElapsedDays = BALANCE.acts.stalemate.start - 1
const finalDaysRemaining = BALANCE.days - BALANCE.acts.final.start + 1
const rescueContactDay = BALANCE.days - BALANCE.rescue.contactDaysRemaining + 1

const MILESTONES: Record<StoryMilestoneId, StoryMilestoneSpec> = {
  prologue: {
    id: 'prologue',
    completeLabel: 'DAY 1へ ▶',
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
  act_stalemate: {
    id: 'act_stalemate',
    completeLabel: '計画へ ▶',
    pages: [
      {
        kicker: `ACT II / 膠着 / DAY ${BALANCE.acts.stalemate.start}`,
        title: '応急修理の限界',
        body: `${stalemateElapsedDays} 日経ちました。応急修理だけでは、もう設備が持ちません。`,
        art: { kind: 'portrait', id: 'engineer', fallbackGlyph: '技' },
        speaker: { name: '技術班', role: '設備担当' },
        ruleNote: `ルール変更：電力劣化 ×${BALANCE.acts.stalemate.powerDecayMult.toFixed(2)}`,
      },
    ],
  },
  act_final: {
    id: 'act_final',
    completeLabel: '計画へ ▶',
    pages: [
      {
        kicker: `ACT III / 正念場 / DAY ${BALANCE.acts.final.start}`,
        title: `救援まで残り ${finalDaysRemaining} 日`,
        body: `薬も設備も限界です。あと ${finalDaysRemaining} 日。ここからが一番長い ${finalDaysRemaining} 日になります。`,
        art: { kind: 'portrait', id: 'medic', fallbackGlyph: '医' },
        speaker: { name: '医療班', role: '診療所' },
        ruleNote: `ルール変更：電力劣化 ×${BALANCE.acts.final.powerDecayMult.toFixed(2)} / 医療消耗 ×${BALANCE.acts.final.medicalDecayMult.toFixed(2)} / 収入 ×${BALANCE.acts.final.incomeMult.toFixed(2)}`,
      },
    ],
  },
  rescue_near: {
    id: 'rescue_near',
    completeLabel: '計画へ ▶',
    pages: [
      {
        kicker: `救援隊から通信 / DAY ${rescueContactDay}`,
        title: `救援まであと ${BALANCE.rescue.contactDaysRemaining} 日`,
        body: `救援隊より孤立地区へ。道路啓開は最終区間に入った。到着予定、${BALANCE.rescue.contactDaysRemaining}日後。`,
        art: { kind: 'event', id: 'rescue_contact', fallbackGlyph: '通' },
        speaker: { name: '真壁史子', role: '町長' },
      },
    ],
  },
}

export function isPlayStoryMilestoneId(value: string): value is PlayStoryMilestoneId {
  return (PLAY_STORY_MILESTONE_IDS as readonly string[]).includes(value)
}

export function storyMilestone(id: StoryMilestoneId): StoryMilestoneSpec {
  return MILESTONES[id]
}

export function createStoryMilestoneSession(id: StoryMilestoneId): StoryMilestoneSession {
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
