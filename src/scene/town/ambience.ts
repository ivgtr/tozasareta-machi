import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { actOf } from '../../game/threat'
import { reducedMotion } from '../../store'
import { COLORS } from '../tokens'

const RAIN_LINES = 40
const SKY_BAND_HEIGHT = 48

export class TownAmbience extends Phaser.GameObjects.Container {
  private readonly skyBand: Phaser.GameObjects.Rectangle
  private readonly darkness: Phaser.GameObjects.Rectangle
  private readonly dangerTint: Phaser.GameObjects.Rectangle
  private readonly weatherTint: Phaser.GameObjects.Rectangle
  private readonly rain: Phaser.GameObjects.Graphics
  private areaW = 0
  private areaH = 0

  constructor(scene: Phaser.Scene) {
    super(scene)
    this.skyBand = scene.add.rectangle(0, 0, 10, SKY_BAND_HEIGHT, COLORS.amber, 0)
    this.skyBand.setOrigin(0, 0)
    this.darkness = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0)
    this.darkness.setOrigin(0, 0)
    this.dangerTint = scene.add.rectangle(0, 0, 10, 10, COLORS.red, 0)
    this.dangerTint.setOrigin(0, 0)
    this.weatherTint = scene.add.rectangle(0, 0, 10, 10, COLORS.cyan, 0)
    this.weatherTint.setOrigin(0, 0)
    this.rain = scene.add.graphics()
    this.rain.setVisible(false)
    this.add([this.skyBand, this.darkness, this.weatherTint, this.dangerTint, this.rain])
    scene.add.existing(this)
  }

  setArea(w: number, h: number): void {
    this.areaW = w
    this.areaH = h
    for (const r of [this.skyBand, this.darkness, this.dangerTint, this.weatherTint]) {
      r.setSize(w, r === this.skyBand ? SKY_BAND_HEIGHT : h)
    }
    this.drawRain()
  }

  update(state: GameState): void {
    const power = Math.max(0, Math.min(100, state.resources.power))
    this.darkness.setAlpha(0.4 * (1 - power / 100))

    const act = actOf(state.day)
    if (act === 1) {
      this.skyBand.setAlpha(0)
    } else {
      this.skyBand.setFillStyle(act === 2 ? COLORS.amber : COLORS.red, 1)
      this.skyBand.setAlpha(act === 2 ? 0.08 : 0.12)
    }

    const danger = state.resources.morale < BALANCE.morale.riotAt || state.resources.food <= 0
    this.scene.tweens.killTweensOf(this.dangerTint)
    if (danger) {
      this.dangerTint.setAlpha(0.1)
      if (!reducedMotion()) {
        this.scene.tweens.add({
          targets: this.dangerTint,
          alpha: { from: 0.06, to: 0.18 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        })
      } else {
        this.dangerTint.setAlpha(0.12)
      }
    } else {
      this.dangerTint.setAlpha(0)
    }

    const mods = state.modifiers.map((m) => m.id)
    const typhoon = mods.includes('typhoon')
    const cold = mods.includes('cold_snap')
    this.weatherTint.setAlpha(cold ? 0.12 : 0)
    this.rain.setVisible(typhoon)
    this.scene.tweens.killTweensOf(this.rain)
    if (typhoon && !reducedMotion()) {
      this.rain.setY(-this.areaH)
      this.scene.tweens.add({
        targets: this.rain,
        y: 0,
        duration: 500,
        repeat: -1,
      })
    } else {
      this.rain.setY(0)
    }
  }

  private drawRain(): void {
    const g = this.rain
    g.clear()
    g.lineStyle(1, COLORS.cyan, 0.5)
    for (let i = 0; i < RAIN_LINES; i++) {
      const x = ((i * 97) % this.areaW) + 4
      const y = ((i * 53) % this.areaH) + 4
      g.lineBetween(x, y, x - 3, y + 10)
    }
  }
}
