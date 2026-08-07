import Phaser from 'phaser'
import { SCENE_EVENTS } from './keys'
import { designSizeOf, deviceClassOf, type DeviceClass } from './layout'
import { BootScene } from './scenes/BootScene'
import { PlayScene } from './scenes/PlayScene'
import { TitleScene } from './scenes/TitleScene'
import { COLORS, colorCss } from './tokens'

export function createGame(parent: HTMLElement): Phaser.Game {
  const design = designSizeOf(deviceClassOf(window.innerWidth))
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: design.width,
    height: design.height,
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

function watchDeviceClass(game: Phaser.Game): void {
  let current: DeviceClass = deviceClassOf(window.innerWidth)
  const apply = (): void => {
    const next = deviceClassOf(window.innerWidth)
    if (next !== current) {
      current = next
      const size = designSizeOf(next)
      game.scale.setGameSize(size.width, size.height)
    }
    game.events.emit(SCENE_EVENTS.deviceClass, next)
  }
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
  })
}
