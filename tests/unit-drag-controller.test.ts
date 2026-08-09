import { describe, expect, it, vi } from 'vitest'
import { UnitDragController } from '../src/scene/unit-drag-controller'

function setup(interactive = true) {
  const ghost = {
    setPosition: vi.fn(),
    setVisible: vi.fn(),
  }
  const onTap = vi.fn()
  const onDragStart = vi.fn()
  const onDragMove = vi.fn()
  const onDragEnd = vi.fn()
  const onDrop = vi.fn()
  const controller = new UnitDragController({
    threshold: 8,
    ghost,
    canInteract: () => interactive,
    onTap,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDrop,
  })
  return { controller, ghost, onTap, onDragStart, onDragMove, onDragEnd, onDrop }
}

describe('UnitDragController', () => {
  it('移動量が閾値以内ならタップとして扱う', () => {
    const { controller, onTap, onDrop, onDragStart } = setup()
    controller.pointerDown('farmer', 10, 10)
    controller.pointerMove({ worldX: 14, worldY: 12 })
    controller.pointerUp({ worldX: 14, worldY: 12 })

    expect(onTap).toHaveBeenCalledWith('farmer')
    expect(onDrop).not.toHaveBeenCalled()
    expect(onDragStart).not.toHaveBeenCalled()
  })

  it('閾値を超えるとdrag lifecycleを通知してドロップへ移行する', () => {
    const { controller, ghost, onTap, onDragStart, onDragMove, onDragEnd, onDrop } = setup()
    controller.pointerDown('farmer', 10, 10)
    controller.pointerMove({ worldX: 20, worldY: 10 })
    controller.pointerMove({ worldX: 24, worldY: 14 })
    controller.pointerUp({ worldX: 30, worldY: 40 })

    expect(onDragStart).toHaveBeenCalledWith('farmer')
    expect(ghost.setVisible).toHaveBeenNthCalledWith(1, true)
    expect(ghost.setPosition).toHaveBeenCalledWith(20, 10)
    expect(onDragMove).toHaveBeenCalledWith('farmer', 24, 14)
    expect(ghost.setVisible).toHaveBeenLastCalledWith(false)
    expect(onDragEnd).toHaveBeenCalledWith('farmer')
    expect(onDrop).toHaveBeenCalledWith('farmer', 30, 40)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('操作不能になった場合は進行中のドラッグを破棄する', () => {
    let interactive = true
    const ghost = { setPosition: vi.fn(), setVisible: vi.fn() }
    const onDragEnd = vi.fn()
    const onDrop = vi.fn()
    const controller = new UnitDragController({
      threshold: 8,
      ghost,
      canInteract: () => interactive,
      onTap: vi.fn(),
      onDragStart: vi.fn(),
      onDragMove: vi.fn(),
      onDragEnd,
      onDrop,
    })

    controller.pointerDown('farmer', 0, 0)
    controller.pointerMove({ worldX: 9, worldY: 0 })
    interactive = false
    controller.pointerMove({ worldX: 10, worldY: 0 })
    controller.pointerUp({ worldX: 10, worldY: 0 })

    expect(ghost.setVisible).toHaveBeenLastCalledWith(false)
    expect(onDragEnd).toHaveBeenCalledWith('farmer')
    expect(onDrop).not.toHaveBeenCalled()
  })
})
