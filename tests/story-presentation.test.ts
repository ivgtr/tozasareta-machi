import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { deriveStoryPresentation } from '../src/scene/story/story-metadata'

describe('story presentation metadata', () => {
  it('人物が関わるイベントを在籍ユニットへ解決する', () => {
    const model = deriveStoryPresentation('generator_failure', createInitialState(1))

    expect(model?.speaker?.id).toBe('engineer')
  })

  it('speakerが不在なら人物なしの表示モデルへ解決する', () => {
    const state = createInitialState(1)
    const model = deriveStoryPresentation('infection', {
      units: state.units.filter((unit) => unit.id !== 'medic'),
    })

    expect(model?.speaker).toBeNull()
  })

  it('speakerを持たないイベントを人物なしの表示モデルへ解決する', () => {
    const model = deriveStoryPresentation('road_collapse', createInitialState(1))

    expect(model?.speaker).toBeNull()
  })

  it('EventとChoiceが同じmetadata resolverを利用する', () => {
    const state = createInitialState(1)

    expect(deriveStoryPresentation('trade_offer', state)?.speaker?.id).toBe('mayor')
    expect(deriveStoryPresentation('power_crisis', state)?.speaker?.id).toBe('engineer')
  })
})
