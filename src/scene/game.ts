import Phaser from 'phaser'
import { SCENE_EVENTS } from './keys'
import { designSizeOf, deviceClassOf, type DeviceClass } from './layout'
import { BootScene } from './scenes/BootScene'
import { PlayScene } from './scenes/PlayScene'
import { TitleScene } from './scenes/TitleScene'
import { COLORS, colorCss } from './tokens'

export function createGame(parent: HTMLElement): Phaser.Game {
  const design = designSizeOf(deviceClassOf(window.innerWidth))
  const size = renderSize(design.width, design.height)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: size.width,
    height: size.height,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: colorCss(COLORS.night900),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TitleScene, PlayScene],
  })
  parent.style.backgroundColor = colorCss(COLORS.night900)
  game.events.once(Phaser.Core.Events.READY, () => {
    const canvas = game.canvas
    if (!canvas) return
    canvas.style.touchAction = 'none'
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())
  })
  watchDeviceClass(game)
  return game
}

function renderScale(): number {
  return Math.min(window.devicePixelRatio || 1, 2)
}

function renderSize(width: number, height: number): { width: number; height: number } {
  const rs = renderScale()
  return { width: Math.round(width * rs), height: Math.round(height * rs) }
}

function watchDeviceClass(game: Phaser.Game): void {
  let current: DeviceClass = deviceClassOf(window.innerWidth)
  const apply = (): void => {
    const next = deviceClassOf(window.innerWidth)
    if (next === current) return
    current = next
    const size = renderSize(designSizeOf(next).width, designSizeOf(next).height)
    game.scale.setGameSize(size.width, size.height)
    game.events.emit(SCENE_EVENTS.deviceClass, next)
  }
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
  })
}
