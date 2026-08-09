import { describe, expect, it } from 'vitest'
import { TASK_DEFS, TASK_IDS, PHYSICAL_TASKS } from '../src/game/data/tasks'
import { createInitialState } from '../src/game/state'
import { unitChangesBetween } from '../src/game/effects'
import { TASK_PRESENTATION } from '../src/scene/task-presentation'
import { FACILITIES } from '../src/scene/town/facilities'
import { resolveFx } from '../src/scene/town/fx-map'
import { unitVisualState } from '../src/scene/unit-visual'
import { buildPlaybackEffects } from '../src/scene/playback/contract'
import type { Effect } from '../src/game/types'

describe('task registries', () => {
  it('全Taskがgame定義とscene表示定義を持つ', () => {
    expect(Object.keys(TASK_DEFS).sort()).toEqual([...TASK_IDS].sort())
    expect(Object.keys(TASK_PRESENTATION).sort()).toEqual([...TASK_IDS].sort())
  })

  it('物理Taskの施設割当とFXが同じpresentation定義から解決される', () => {
    for (const task of PHYSICAL_TASKS) {
      const presentation = TASK_PRESENTATION[task]
      expect(FACILITIES[presentation.facility].task).toBe(task)
      expect(resolveFx(`task:${task}`, 'food')).toEqual({
        facility: presentation.facility,
        kind: presentation.fxKind,
      })
    }
  })
})

describe('unit display contract', () => {
  it('負傷状態と最高適性をstateから毎回導出する', () => {
    const unit = createInitialState(1).units[0]!
    const updated = {
      ...unit,
      condition: 'injured' as const,
      apt: { ...unit.apt, labor: 10, tech: 0, medical: 0, charm: 0 },
    }

    expect(unitVisualState(updated)).toEqual({ condition: 'injured', topAptitude: 'labor' })
  })

  it('Unit差分は表示用のsync/remove契約へ変換される', () => {
    const previous = createInitialState(1)
    const changed = { ...previous.units[0]!, condition: 'injured' as const }
    const removed = previous.units[1]!
    const next = [changed, ...previous.units.slice(2)]
    const changes = unitChangesBetween(previous.units, next)

    expect(changes).toContainEqual({ kind: 'sync', unit: changed })
    expect(changes).toContainEqual({ kind: 'remove', unit: removed })
  })
})

describe('playback contract', () => {
  it('新規加入はunitターゲットへ紐づけ、既存Unit更新は最後まで先取りしない', () => {
    const previous = createInitialState(1)
    const existing = previous.units[0]!
    const changed = { ...existing, condition: 'injured' as const }
    const newcomer = { ...previous.units[1]!, id: 'newcomer', name: '新参者' }
    const final = { ...previous, units: [changed, ...previous.units.slice(1), newcomer] }
    const effects: Effect[] = [
      { day: 1, source: 'event:arrival', target: 'unit:newcomer', delta: 0, reason: '到着' },
      { day: 1, source: 'settlement', target: 'morale', delta: -1, reason: '変化' },
    ]

    const playback = buildPlaybackEffects(previous, final, effects)
    expect(playback[0]?.unitChanges).toEqual([{ kind: 'sync', unit: newcomer }])
    expect(playback[1]?.unitChanges).toContainEqual({ kind: 'sync', unit: changed })
  })

  it('死亡によるremoveは死亡unitターゲットへ結び付ける', () => {
    const previous = createInitialState(1)
    const dead = previous.units[0]!
    const final = { ...previous, units: previous.units.slice(1) }
    const effects: Effect[] = [
      {
        day: 1,
        source: 'death:starvation',
        target: `unit:${dead.id}`,
        delta: 0,
        reason: '死亡',
      },
      {
        day: 1,
        source: 'death:starvation',
        target: 'flag:casualties',
        delta: 1,
        reason: '犠牲者',
      },
      { day: 1, source: 'settlement', target: 'morale', delta: -8, reason: '喪失' },
    ]

    const playback = buildPlaybackEffects(previous, final, effects)
    expect(playback[0]?.unitChanges).toEqual([{ kind: 'remove', unit: dead }])
    expect(playback[2]?.unitChanges).toBeUndefined()
  })
})
