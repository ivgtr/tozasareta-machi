import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { DeathBeat } from '../src/scene/playback/beats'
import { deriveDeathPresentation } from '../src/scene/story/death-model'

describe('death presentation model', () => {
  it('死亡した人物のsnapshot・死因・理由を表示モデルへ保持する', () => {
    const state = createInitialState(1)
    const unit = state.units[0]!
    const beat: DeathBeat = {
      kind: 'death',
      cause: 'starvation',
      unit,
      effects: [
        {
          day: state.day,
          source: 'death:starvation',
          target: `unit:${unit.id}`,
          delta: 0,
          reason: `${unit.name}が食料不足により亡くなった`,
        },
      ],
    }
    const model = deriveDeathPresentation(beat)

    expect(model.unit).toEqual(unit)
    expect(model.causeLabel).toBe('食料不足')
    expect(model.reason).toContain(unit.name)
  })

  it('探索死亡には探索中の事故という死因ラベルを使う', () => {
    const state = createInitialState(1)
    const unit = state.units[1]!
    const beat: DeathBeat = {
      kind: 'death',
      cause: 'expedition',
      unit,
      effects: [],
    }

    expect(deriveDeathPresentation(beat).causeLabel).toBe('探索中の事故')
  })
})
