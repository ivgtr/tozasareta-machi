import Phaser from 'phaser'
import { getSettings } from '../../store'

const FADE_MS = 160

export function fadeInScene(scene: Phaser.Scene): void {
  if (!getSettings().animations) return
  scene.cameras.main.fadeIn(FADE_MS, 10, 14, 36)
}

export function transitionToScene(scene: Phaser.Scene, key: string): void {
  if (!getSettings().animations) {
    scene.scene.start(key)
    return
  }
  scene.cameras.main.fadeOut(FADE_MS, 10, 14, 36)
  scene.time.delayedCall(FADE_MS, () => scene.scene.start(key))
}
