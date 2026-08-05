import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { BALANCE } from '../src/game/data/balance'
import type { DayPlan, Effect, GameState } from '../src/game/types'

const idle: DayPlan = { placements: [], ration: false, procure: false }

const atDay = (seed: number, day: number): GameState => ({ ...createInitialState(seed), day })

const actMod = (s: GameState, id: string) => s.modifiers.filter((m) => m.id === id)

function playDay(from: GameState): { state: GameState; effects: Effect[] } {
  let cur = from
  const effects: Effect[] = []
  let guard = 0
  while (cur.phase !== 'ended' && guard++ < 20) {
    const r =
      cur.phase === 'planning'
        ? step(cur, { type: 'commitDay', plan: idle })
        : step(cur, { type: 'resolveChoice', optionId: cur.pendingChoice?.optionIds[0] ?? '' })
    effects.push(...r.effects)
    cur = r.state
    if (cur.day > from.day) break
  }
  return { state: cur, effects }
}

describe('アクト機構', () => {
  it('アクト1（1–10日）はアクト Modifier を持たない', () => {
    const r = playDay(atDay(1, 5))
    expect(r.state.day).toBe(6)
    expect(r.state.modifiers.some((m) => m.id.startsWith('act_'))).toBe(false)
  })

  it('11日目の境界で膠着期の Modifier が付く（decay:power のみ）', () => {
    const r = playDay(atDay(1, 10))
    expect(r.state.day).toBe(11)
    const mods = actMod(r.state, 'act_stalemate')
    expect(mods).toHaveLength(1)
    expect(mods[0]!.startDay).toBe(11)
    expect(mods[0]!.daysLeft).toBe(BALANCE.acts.final.start - 1 - 11)
    expect(mods[0]!.effects).toEqual([
      { target: 'decay:power', op: 'mult', value: BALANCE.acts.stalemate.powerDecayMult },
    ])
    expect(actMod(r.state, 'act_final')).toHaveLength(0)
  })

  it('膠着期の遷移 effect は追加された日に1本だけ report に載る', () => {
    const r1 = playDay(atDay(1, 10))
    expect(r1.effects.filter((e) => e.source === 'act_stalemate')).toHaveLength(1)
    expect(r1.state.report.filter((e) => e.source === 'act_stalemate')).toHaveLength(1)
    const r2 = playDay(r1.state)
    expect(r2.effects.filter((e) => e.source === 'act_stalemate')).toHaveLength(0)
    expect(actMod(r2.state, 'act_stalemate')).toHaveLength(1)
  })

  it('膠着期は追加された日（11日目）の清算からすぐに効く', () => {
    const s11 = playDay(atDay(1, 10)).state
    const r = playDay(s11)
    const decay = r.state.report.find((e) => e.reason === '発電設備が劣化した')
    expect(decay?.delta).toBe(
      -Math.round(BALANCE.power.decay * BALANCE.acts.stalemate.powerDecayMult),
    )
  })

  it('21日目の境界で正念場に交代する（膠着期は消え、3つの修正が付く）', () => {
    const s20: GameState = {
      ...atDay(2, 20),
      modifiers: [
        {
          id: 'act_stalemate',
          daysLeft: 1,
          startDay: 11,
          effects: [
            {
              target: 'decay:power',
              op: 'mult',
              value: BALANCE.acts.stalemate.powerDecayMult,
            },
          ],
        },
      ],
    }
    const r = playDay(s20)
    expect(r.state.day).toBe(21)
    expect(actMod(r.state, 'act_stalemate')).toHaveLength(0)
    const mods = actMod(r.state, 'act_final')
    expect(mods).toHaveLength(1)
    expect(mods[0]!.startDay).toBe(21)
    expect(mods[0]!.daysLeft).toBe(BALANCE.days - 21)
    expect(mods[0]!.effects).toEqual([
      { target: 'decay:power', op: 'mult', value: BALANCE.acts.final.powerDecayMult },
      { target: 'decay:medical', op: 'mult', value: BALANCE.acts.final.medicalDecayMult },
      { target: 'income:budget', op: 'mult', value: BALANCE.acts.final.incomeMult },
    ])
    expect(r.effects.filter((e) => e.source === 'act_final')).toHaveLength(1)
  })

  it('正念場は21日目の清算から電力・医療の衰えに効く', () => {
    const s21 = playDay(atDay(2, 20)).state
    const r = playDay(s21)
    const powerDecay = r.state.report.find((e) => e.reason === '発電設備が劣化した')
    expect(powerDecay?.delta).toBe(
      -Math.round(BALANCE.power.decay * BALANCE.acts.final.powerDecayMult),
    )
    const medDecay = r.state.report.find(
      (e) => e.source === 'settlement' && e.target === 'medical' && e.delta < 0,
    )
    expect(medDecay?.delta).toBe(
      -Math.round(BALANCE.medical.decay * BALANCE.acts.final.medicalDecayMult),
    )
  })

  it('旧セーブ想定の途中再開（15日目）でも初回 finalize で補完される', () => {
    const r = playDay(atDay(3, 15))
    expect(r.state.day).toBe(16)
    const mods = actMod(r.state, 'act_stalemate')
    expect(mods).toHaveLength(1)
    expect(mods[0]!.daysLeft).toBe(BALANCE.acts.final.start - 1 - 16)
    expect(r.effects.some((e) => e.source === 'act_stalemate')).toBe(true)
  })

  it('20日目の途中再開は正念場のみ補完する（過ぎた膠着期は巻き戻さない）', () => {
    const r = playDay(atDay(3, 20))
    expect(r.state.day).toBe(21)
    expect(actMod(r.state, 'act_stalemate')).toHaveLength(0)
    expect(actMod(r.state, 'act_final')).toHaveLength(1)
  })

  it('アクト内で繰り返しても冪等（重複しない）', () => {
    let s = atDay(4, 10)
    for (let i = 0; i < 4; i++) s = playDay(s).state
    expect(s.day).toBe(14)
    expect(actMod(s, 'act_stalemate')).toHaveLength(1)
    expect(actMod(s, 'act_final')).toHaveLength(0)
  })

  it('30日を超えてもアクト Modifier は追加されない', () => {
    const s30: GameState = {
      ...atDay(5, 30),
      modifiers: [
        {
          id: 'act_final',
          daysLeft: 1,
          startDay: 21,
          effects: [
            { target: 'decay:power', op: 'mult', value: BALANCE.acts.final.powerDecayMult },
          ],
        },
      ],
    }
    const r = playDay(s30)
    expect(r.state.phase).toBe('ended')
    expect(r.state.modifiers.some((m) => m.id.startsWith('act_'))).toBe(false)
  })
})
