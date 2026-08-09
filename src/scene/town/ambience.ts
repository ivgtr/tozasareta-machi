import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { COLORS } from '../tokens'
import { deriveTownAmbience, type TownAmbienceModel } from './ambience-model'
import { FACILITY_PLOTS, TOWN_BASE } from './layout'

const MAX_DARKNESS = 0.46
const RAIN_FAR_LINES = 44
const RAIN_NEAR_LINES = 26
const COLD_FLECKS = 22
const SMOKE_LAYER_COUNT = 3
const POWER_PLOT = FACILITY_PLOTS.find((plot) => plot.id === 'power')!

export class TownAmbience extends Phaser.GameObjects.Container {
  private readonly darkness: Phaser.GameObjects.Rectangle
  private readonly horizon: Phaser.GameObjects.Graphics
  private readonly smokeLayers: Phaser.GameObjects.Graphics[]
  private readonly rainFar: Phaser.GameObjects.Graphics
  private readonly rainNear: Phaser.GameObjects.Graphics
  private readonly coldFlecks: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    super(scene)

    this.darkness = scene.add.rectangle(0, 0, TOWN_BASE.width, TOWN_BASE.height, 0x000000, 0)
    this.darkness.setOrigin(0)
    this.horizon = scene.add.graphics()
    this.smokeLayers = Array.from({ length: SMOKE_LAYER_COUNT }, () => scene.add.graphics())
    this.rainFar = scene.add.graphics()
    this.rainNear = scene.add.graphics()
    this.coldFlecks = scene.add.graphics()

    this.drawRainLayer(this.rainFar, RAIN_FAR_LINES, false)
    this.drawRainLayer(this.rainNear, RAIN_NEAR_LINES, true)
    this.drawColdFlecks()

    this.add([
      this.darkness,
      this.horizon,
      ...this.smokeLayers,
      this.rainFar,
      this.rainNear,
      this.coldFlecks,
    ])
  }

  update(state: GameState): void {
    const model = deriveTownAmbience(state)
    const reduceMotion = reducedMotion()

    this.stopMotion()
    this.drawGlobalTone(model)
    this.drawSmoke(model, reduceMotion)
    this.updateWeather(model, reduceMotion)
  }

  private drawGlobalTone(model: TownAmbienceModel): void {
    this.darkness.setAlpha(MAX_DARKNESS * (1 - model.powerRatio))

    const g = this.horizon
    g.clear()
    if (model.act === 1) return

    const color = model.act === 2 ? COLORS.amber : COLORS.red
    const alpha = model.act === 2 ? 0.08 : 0.12
    g.fillStyle(color, alpha)
    g.fillRect(42, 44, 118, 1)
    g.fillRect(278, 36, 132, 1)
    g.fillRect(184, 52, 76, 1)
  }

  private drawSmoke(model: TownAmbienceModel, reduceMotion: boolean): void {
    const active = model.powerRatio > 0

    for (const [index, layer] of this.smokeLayers.entries()) {
      layer.clear()
      layer.setPosition(0, 0)
      layer.setVisible(active)
      layer.setAlpha(active ? 0.34 : 0)
      if (!active) continue

      const x = POWER_PLOT.x + 24 + index * 2
      const y = POWER_PLOT.y - 73 - index * 4
      layer.fillStyle(COLORS.inkDim, 0.48)
      layer.fillRect(x, y, 3, 3)
      layer.fillRect(x + 3, y - 3, 4, 3)
      layer.fillStyle(COLORS.frameLo, 0.24)
      layer.fillRect(x + 5, y - 6, 3, 2)
    }

    if (!active || reduceMotion) {
      this.smokeLayers.forEach((layer, index) => layer.setAlpha(index === 0 && active ? 0.28 : 0))
      return
    }

    this.smokeLayers.forEach((layer, index) => {
      this.scene.tweens.add({
        targets: layer,
        x: index % 2 === 0 ? 4 : -3,
        y: -18,
        alpha: { from: 0.32, to: 0 },
        duration: 1_350,
        delay: index * 360,
        repeat: -1,
        ease: 'Linear',
      })
    })
  }

  private updateWeather(model: TownAmbienceModel, reduceMotion: boolean): void {
    const typhoon = model.weather === 'typhoon'
    const cold = model.weather === 'cold'

    this.rainFar.setVisible(typhoon)
    this.rainNear.setVisible(typhoon)
    this.coldFlecks.setVisible(cold)

    if (typhoon) {
      this.rainFar.setAlpha(0.32)
      this.rainNear.setAlpha(0.5)
      if (!reduceMotion) {
        this.scene.tweens.add({
          targets: this.rainFar,
          x: -5,
          y: 16,
          duration: 640,
          repeat: -1,
          ease: 'Linear',
        })
        this.scene.tweens.add({
          targets: this.rainNear,
          x: -9,
          y: 30,
          duration: 410,
          repeat: -1,
          ease: 'Linear',
        })
      }
    }

    if (cold) {
      this.coldFlecks.setAlpha(0.34)
      if (!reduceMotion) {
        this.scene.tweens.add({
          targets: this.coldFlecks,
          x: -2,
          y: 5,
          alpha: { from: 0.24, to: 0.46 },
          duration: 1_200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        })
      }
    }
  }

  private drawRainLayer(g: Phaser.GameObjects.Graphics, count: number, foreground: boolean): void {
    g.clear()
    g.lineStyle(1, foreground ? COLORS.frameHi : COLORS.cyan, foreground ? 0.5 : 0.26)

    const width = TOWN_BASE.width + 80
    const height = TOWN_BASE.height + 80
    for (let index = 0; index < count; index += 1) {
      const x = ((index * (foreground ? 97 : 73)) % width) - 40
      const y = ((index * (foreground ? 53 : 41)) % height) - 40
      const dx = foreground ? 5 : 3
      const dy = foreground ? 15 : 8
      g.lineBetween(x, y, x - dx, y + dy)
    }
    g.setVisible(false)
  }

  private drawColdFlecks(): void {
    const g = this.coldFlecks
    g.clear()
    g.fillStyle(COLORS.frameHi, 0.34)

    for (let index = 0; index < COLD_FLECKS; index += 1) {
      const x = ((index * 83) % (TOWN_BASE.width - 20)) + 10
      const y = ((index * 61) % (TOWN_BASE.height - 24)) + 12
      const size = index % 5 === 0 ? 2 : 1
      g.fillRect(x, y, size, size)
    }
    g.setVisible(false)
  }

  private stopMotion(): void {
    const targets = [...this.smokeLayers, this.rainFar, this.rainNear, this.coldFlecks]
    for (const target of targets) {
      this.scene.tweens.killTweensOf(target)
      target.setPosition(0, 0)
      target.setAlpha(1)
    }
  }
}
