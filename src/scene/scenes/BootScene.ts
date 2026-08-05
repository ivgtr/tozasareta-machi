import Phaser from 'phaser'
import { KEYS } from '../keys'
import { sceneAssets } from '../art/assets'
import { FONT_BODY, FONT_DISPLAY } from '../tokens'

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  await Promise.all([
    document.fonts.load(`16px ${FONT_BODY}`),
    document.fonts.load(`16px ${FONT_DISPLAY}`),
  ]).catch(() => undefined)
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(KEYS.boot)
  }

  preload(): void {
    for (const { key, url } of sceneAssets()) {
      this.load.image(key, url)
    }
  }

  create(): void {
    void waitForFonts().then(() => {
      this.scene.start(KEYS.title)
    })
  }
}
