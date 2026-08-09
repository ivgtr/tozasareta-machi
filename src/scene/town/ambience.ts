import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { COLORS } from '../tokens'
import { deriveTownAmbience, type TownAmbienceModel, type TownCondition } from './ambience-model'
import { FACILITY_PLOTS, TOWN_BASE, type FacilityId, type FacilityPlot } from './layout'

const MAX_DARKNESS = 0.46
const RAIN_FAR_LINES = 44
const RAIN_NEAR_LINES = 26
const COLD_FLECKS = 22
const SMOKE_LAYER_COUNT = 3

export class TownAmbience extends Phaser.GameObjects.Container {
  private readonly darkness: Phaser.GameObjects.Rectangle
  private readonly horizon: Phaser.GameObjects.Graphics
  private readonly facilityCues: Phaser.GameObjects.Graphics
  private readonly smokeLayers: Phaser.GameObjects.Graphics[]
  private readonly rainFar: Phaser.GameObjects.Graphics
  private readonly rainNear: Phaser.GameObjects.Graphics
  private readonly coldFlecks: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    super(scene)

    this.darkness = scene.add.rectangle(0, 0, TOWN_BASE.width, TOWN_BASE.height, 0x000000, 0)
    this.darkness.setOrigin(0)
    this.horizon = scene.add.graphics()
    this.facilityCues = scene.add.graphics()
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
      this.facilityCues,
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
    this.drawFacilityCues(model)
    this.drawSmoke(model, reduceMotion)
    this.updateWeather(model, reduceMotion)
  }

  private drawGlobalTone(model: TownAmbienceModel): void {
    this.darkness.setAlpha(MAX_DARKNESS * (1 - model.power.ratio))

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

  private drawFacilityCues(model: TownAmbienceModel): void {
    const g = this.facilityCues
    g.clear()

    this.drawPowerCues(g, model)
    this.drawClinicCues(g, model)
    this.drawPlazaCues(g, model)
    this.drawWarehouseCues(g, model)
  }

  private drawPowerCues(g: Phaser.GameObjects.Graphics, model: TownAmbienceModel): void {
    const plot = plotOf('power')
    const windowXs = [-17, -6, 5, 16]

    for (let index = 0; index < windowXs.length; index += 1) {
      if (index >= model.power.lights) continue
      g.fillStyle(COLORS.amber, 0.72)
      g.fillRect(plot.x + windowXs[index]!, plot.y - 50, 4, 3)
      g.fillStyle(COLORS.gold, 0.28)
      g.fillRect(plot.x + windowXs[index]! - 1, plot.y - 51, 6, 5)
    }

    const statusColor = conditionColor(model.power.condition, COLORS.cyan)
    g.fillStyle(statusColor, model.power.condition === 'stable' ? 0.56 : 0.9)
    g.fillRect(plot.x + 29, plot.y - 64, 2, 3)
  }

  private drawClinicCues(g: Phaser.GameObjects.Graphics, model: TownAmbienceModel): void {
    const plot = plotOf('clinic')
    const color = conditionColor(model.medical.condition, COLORS.green)
    const litWindows = Math.max(1, Math.ceil(model.medical.ratio * 2))

    for (let index = 0; index < litWindows; index += 1) {
      g.fillStyle(COLORS.amber, 0.52)
      g.fillRect(plot.x - 8 + index * 12, plot.y - 48, 5, 3)
    }

    g.fillStyle(color, model.medical.condition === 'stable' ? 0.68 : 0.92)
    g.fillRect(plot.x + 27, plot.y - 58, 2, 4)
    g.fillRect(plot.x + 26, plot.y - 57, 4, 2)
  }

  private drawPlazaCues(g: Phaser.GameObjects.Graphics, model: TownAmbienceModel): void {
    const plot = plotOf('plaza')
    const color = conditionColor(model.morale.condition, COLORS.gold)
    const embers = Math.max(1, Math.ceil(model.morale.ratio * 3))

    for (let index = 0; index < embers; index += 1) {
      g.fillStyle(index % 2 === 0 ? color : COLORS.amber, 0.64)
      g.fillRect(plot.x - 5 + index * 5, plot.y - 19 - (index % 2) * 2, 2, 2)
    }
  }

  private drawWarehouseCues(g: Phaser.GameObjects.Graphics, model: TownAmbienceModel): void {
    const plot = plotOf('warehouse')
    this.drawCrates(g, plot.x - 25, plot.y - 24, model.supplies.foodCrates, COLORS.amber, false)
    this.drawCrates(g, plot.x - 4, plot.y - 25, model.supplies.reserveCrates, COLORS.cyan, true)
  }

  private drawCrates(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    count: number,
    color: number,
    raised: boolean,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / 2)
      const column = index % 2
      const crateX = x + column * 7
      const crateY = y - row * 5 - (raised ? 2 : 0)
      g.fillStyle(COLORS.night700, 0.8)
      g.fillRect(crateX, crateY, 5, 4)
      g.lineStyle(1, color, 0.56)
      g.strokeRect(crateX, crateY, 5, 4)
    }
  }

  private drawSmoke(model: TownAmbienceModel, reduceMotion: boolean): void {
    const plot = plotOf('power')
    const active = model.power.ratio > 0

    for (const [index, layer] of this.smokeLayers.entries()) {
      layer.clear()
      layer.setPosition(0, 0)
      layer.setVisible(active)
      layer.setAlpha(active ? 0.34 : 0)
      if (!active) continue

      const x = plot.x + 24 + index * 2
      const y = plot.y - 73 - index * 4
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

function plotOf(id: FacilityId): FacilityPlot {
  const plot = FACILITY_PLOTS.find((candidate) => candidate.id === id)
  if (!plot) throw new Error(`Unknown facility plot: ${id}`)
  return plot
}

function conditionColor(condition: TownCondition, stable: number): number {
  if (condition === 'critical') return COLORS.red
  if (condition === 'strained') return COLORS.amber
  return stable
}
