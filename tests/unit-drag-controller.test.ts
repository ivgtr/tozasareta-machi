import { describe, expect, it, vi } from 'vitest'
import { UnitDragController } from '../src/scene/unit-drag-controller'

function setup(interactive = true) {
  const ghost = {
    setPosition: vi.fn(),
    setVisible: vi.fn(),
  }
  const onTap = vi.fn()
  const onDrop = vi.fn()
  const controller = new UnitDragController({
    threshold: 8,
    ghost,
    canInteract: () => interactive,
    onTap,
    onDrop,
  })
  return { controller, ghost, onTap, onDrop }
}

describe('UnitDragController', () => {
  it('移動量が閾値以内ならタップとして扱う', () => {
    const { controller, onTap, onDrop } = setup()
    controller.pointerDown('farmer', 10, 10)
    controller.pointerMove({ worldX: 14, worldY: 12 })
    controller.pointerUp({ worldX: 14, worldY: 12 })

    expect(onTap).toHaveBeenCalledWith('farmer')
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('閾値を超えるとゴーストを表示してドロップへ移行する', () => {
    const { controller, ghost, onTap, onDrop } = setup()
    controller.pointerDown('farmer', 10, 10)
    controller.pointerMove({ worldX: 20, worldY: 10 })
    controller.pointerUp({ worldX: 30, worldY: 40 })

    expect(ghost.setVisible).toHaveBeenNthCalledWith(1, true)
    expect(ghost.setPosition).toHaveBeenCalledWith(20, 10)
    expect(ghost.setVisible).toHaveBeenLastCalledWith(false)
    expect(onDrop).toHaveBeenCalledWith('farmer', 30, 40)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('操作不能になった場合は進行中のドラッグを破棄する', () => {
    let interactive = true
    const ghost = { setPosition: vi.fn(), setVisible: vi.fn() }
    const onDrop = vi.fn()
    const controller = new UnitDragController({
      threshold: 8,
      ghost,
      canInteract: () => interactive,
      onTap: vi.fn(),
      onDrop,
    })

    controller.pointerDown('farmer', 0, 0)
    controller.pointerMove({ worldX: 9, worldY: 0 })
    interactive = false
    controller.pointerMove({ worldX: 10, worldY: 0 })
    controller.pointerUp({ worldX: 10, worldY: 0 })

    expect(ghost.setVisible).toHaveBeenLastCalledWith(false)
    expect(onDrop).not.toHaveBeenCalled()
  })
})
