import Phaser from 'phaser'
import { reducedMotion } from '../../store'
import { COLORS } from '../tokens'
import { deriveTownAmbience, type TownAmbienceModel, type TownCondition } from './ambience-model'
import type { FacilityViewMap } from './facilities'
import { FACILITY_PLOTS, TOWN_BASE, type FacilityId, type FacilityPlot } from './layout'
import type { GameState } from '../../game/types'

const SKY_BAND_HEIGHT = 64
const RAIN_LINES = 72
const COLD_FLECKS = 28
const SIGNAL_STEPS = 4
const MAX_DARKNESS = 0.46
const WORK_PULSE_ALPHA = 0.72

export class TownAmbience extends Phaser.GameObjects.Container {
  private readonly skyBand: Phaser.GameObjects.Rectangle
  private readonly darkness: Phaser.GameObjects.Rectangle
  private readonly weatherTint: Phaser.GameObjects.Rectangle
  private readonly dangerTint: Phaser.GameObjects.Rectangle
  private readonly signals: Phaser.GameObjects.Graphics
  private readonly activity: Phaser.GameObjects.Graphics
  private readonly smoke: Phaser.GameObjects.Graphics
  private readonly rain: Phaser.GameObjects.Graphics
  private readonly coldFlecks: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    super(scene)

    this.skyBand = scene.add.rectangle(0, 0, TOWN_BASE.width, SKY_BAND_HEIGHT, COLORS.amber, 0)
    this.skyBand.setOrigin(0)
    this.darkness = scene.add.rectangle(0, 0, TOWN_BASE.width, TOWN_BASE.height, 0x000000, 0)
    this.darkness.setOrigin(0)
    this.weatherTint = scene.add.rectangle(0, 0, TOWN_BASE.width, TOWN_BASE.height, COLORS.cyan, 0)
    this.weatherTint.setOrigin(0)
    this.dangerTint = scene.add.rectangle(0, 0, TOWN_BASE.width, TOWN_BASE.height, COLORS.red, 0)
    this.dangerTint.setOrigin(0)

    this.signals = scene.add.graphics()
    this.activity = scene.add.graphics()
    this.smoke = scene.add.graphics()
    this.rain = scene.add.graphics()
    this.coldFlecks = scene.add.graphics()

    this.drawRain()
    this.drawColdFlecks()
    this.add([
      this.darkness,
      this.skyBand,
      this.weatherTint,
      this.signals,
      this.activity,
      this.smoke,
      this.rain,
      this.coldFlecks,
      this.dangerTint,
    ])
  }

  update(state: GameState, facilityView: FacilityViewMap): void {
    const model = deriveTownAmbience(state, facilityView)
    const reduceMotion = reducedMotion()

    this.stopMotion()
    this.updateGlobalTone(model, reduceMotion)
    this.drawSignals(model)
    this.drawActivity(model, reduceMotion)
    this.drawSmoke(model, reduceMotion)
    this.updateWeather(model, reduceMotion)
  }

  private updateGlobalTone(model: TownAmbienceModel, reduceMotion: boolean): void {
    this.darkness.setAlpha(MAX_DARKNESS * (1 - model.power.ratio))

    if (model.act === 1) {
      this.skyBand.setAlpha(0)
    } else {
      this.skyBand.setFillStyle(model.act === 2 ? COLORS.amber : COLORS.red, 1)
      this.skyBand.setAlpha(model.act === 2 ? 0.08 : 0.12)
    }

    if (!model.danger) {
      this.dangerTint.setAlpha(0)
      return
    }

    if (reduceMotion) {
      this.dangerTint.setAlpha(0.08)
      return
    }

    this.scene.tweens.add({
      targets: this.dangerTint,
      alpha: { from: 0.035, to: 0.11 },
      duration: 850,
      yoyo: true,
      repeat: -1,
    })
  }

  private drawSignals(model: TownAmbienceModel): void {
    const g = this.signals
    g.clear()

    this.drawPowerSignals(g, model)
    this.drawClinicSignal(g, model.medical.condition)
    this.drawPlazaSignal(g, model.morale.condition, model.morale.ratio)
    this.drawWarehouseSignals(g, model.supplies.foodCrates, model.supplies.reserveCrates)
    this.drawRoadSignal(g, model.road)
  }

  private drawPowerSignals(g: Phaser.GameObjects.Graphics, model: TownAmbienceModel): void {
    const plot = plotOf('power')
    const color = conditionColor(model.power.condition, COLORS.cyan)
    const startX = plot.x - 18
    const y = plot.y - 50

    for (let index = 0; index < SIGNAL_STEPS; index += 1) {
      const lit = index < model.power.lights
      g.fillStyle(lit ? color : COLORS.night900, lit ? 0.9 : 0.6)
      g.fillRect(startX + index * 12, y, 7, 5)
    }

    if (model.power.condition !== 'stable') {
      g.lineStyle(1, color, 0.75)
      g.strokeCircle(plot.x, plot.y - 30, 20)
    }
  }

  private drawClinicSignal(g: Phaser.GameObjects.Graphics, condition: TownCondition): void {
    const plot = plotOf('clinic')
    const color = conditionColor(condition, COLORS.green)
    const x = plot.x + 27
    const y = plot.y - 57

    g.fillStyle(color, 0.92)
    g.fillRect(x - 2, y - 7, 4, 14)
    g.fillRect(x - 7, y - 2, 14, 4)
  }

  private drawPlazaSignal(
    g: Phaser.GameObjects.Graphics,
    condition: TownCondition,
    ratio: number,
  ): void {
    const plot = plotOf('plaza')
    const color = conditionColor(condition, COLORS.gold)
    const count = Math.max(1, Math.ceil(ratio * 3))

    for (let index = 0; index < 3; index += 1) {
      g.fillStyle(index < count ? color : COLORS.night900, index < count ? 0.82 : 0.55)
      g.fillCircle(plot.x - 12 + index * 12, plot.y - 43, 3)
    }
  }

  private drawWarehouseSignals(
    g: Phaser.GameObjects.Graphics,
    foodCrates: number,
    reserveCrates: number,
  ): void {
    const plot = plotOf('warehouse')
    this.drawSupplyRow(g, plot.x - 24, plot.y - 50, foodCrates, COLORS.amber)
    this.drawSupplyRow(g, plot.x - 24, plot.y - 42, reserveCrates, COLORS.cyan)
  }

  private drawSupplyRow(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    filled: number,
    color: number,
  ): void {
    for (let index = 0; index < SIGNAL_STEPS; index += 1) {
      g.fillStyle(index < filled ? color : COLORS.night900, index < filled ? 0.82 : 0.52)
      g.fillRect(x + index * 12, y, 8, 5)
    }
  }

  private drawRoadSignal(g: Phaser.GameObjects.Graphics, road: TownAmbienceModel['road']): void {
    const plot = plotOf('road')
    if (road === 'restored') {
      g.lineStyle(2, COLORS.green, 0.75)
      g.lineBetween(plot.x - 26, plot.y + 12, plot.x + 28, plot.y - 16)
      return
    }

    const color = road === 'working' ? COLORS.amber : COLORS.red
    g.fillStyle(color, road === 'working' ? 0.72 : 0.5)
    g.fillCircle(plot.x - 20, plot.y - 16, 3)
    g.fillCircle(plot.x - 6, plot.y - 8, 2)
    g.fillCircle(plot.x + 18, plot.y - 14, 4)
  }

  private drawActivity(model: TownAmbienceModel, reduceMotion: boolean): void {
    const g = this.activity
    g.clear()
    g.setAlpha(1)

    for (const facility of model.workingFacilities) {
      const plot = plotOf(facility)
      const color = activityColor(facility)
      g.lineStyle(2, color, 0.75)
      g.strokeCircle(plot.x, plot.y - 8, 28)
      g.fillStyle(color, 0.78)
      g.fillCircle(plot.x + 24, plot.y - 34, 2)
      g.fillCircle(plot.x + 31, plot.y - 28, 2)
    }

    if (model.workingFacilities.length === 0 || reduceMotion) return

    this.scene.tweens.add({
      targets: this.activity,
      alpha: { from: 0.28, to: WORK_PULSE_ALPHA },
      duration: 720,
      yoyo: true,
      repeat: -1,
    })
  }

  private drawSmoke(model: TownAmbienceModel, reduceMotion: boolean): void {
    const g = this.smoke
    const plot = plotOf('power')
    const active = model.power.ratio > 0 || model.workingFacilities.includes('power')
    g.clear()
    g.setPosition(0, 0)
    g.setAlpha(active ? 0.42 : 0)
    if (!active) return

    g.fillStyle(COLORS.inkDim, 0.55)
    g.fillCircle(plot.x + 25, plot.y - 73, 4)
    g.fillCircle(plot.x + 31, plot.y - 82, 5)
    g.fillCircle(plot.x + 24, plot.y - 91, 6)

    if (reduceMotion) return

    this.scene.tweens.add({
      targets: this.smoke,
      y: -10,
      alpha: { from: 0.18, to: 0.48 },
      duration: 1_300,
      yoyo: true,
      repeat: -1,
    })
  }

  private updateWeather(model: TownAmbienceModel, reduceMotion: boolean): void {
    const typhoon = model.weather === 'typhoon'
    const cold = model.weather === 'cold'

    this.weatherTint.setAlpha(cold ? 0.1 : typhoon ? 0.045 : 0)
    this.rain.setVisible(typhoon)
    this.rain.setAlpha(typhoon ? 0.72 : 1)
    this.coldFlecks.setVisible(cold)

    if (!typhoon || reduceMotion) return

    this.scene.tweens.add({
      targets: this.rain,
      alpha: { from: 0.42, to: 0.82 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    })
  }

  private drawRain(): void {
    const g = this.rain
    g.clear()
    g.lineStyle(1, COLORS.cyan, 0.5)
    for (let index = 0; index < RAIN_LINES; index += 1) {
      const x = ((index * 97) % (TOWN_BASE.width - 12)) + 8
      const y = ((index * 53) % (TOWN_BASE.height - 18)) + 2
      g.lineBetween(x, y, x - 4, y + 13)
    }
    g.setVisible(false)
  }

  private drawColdFlecks(): void {
    const g = this.coldFlecks
    g.clear()
    g.fillStyle(COLORS.frameHi, 0.42)
    for (let index = 0; index < COLD_FLECKS; index += 1) {
      const x = ((index * 83) % (TOWN_BASE.width - 12)) + 6
      const y = ((index * 61) % (TOWN_BASE.height - 18)) + 9
      g.fillRect(x, y, index % 3 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1)
    }
    g.setVisible(false)
  }

  private stopMotion(): void {
    for (const target of [this.dangerTint, this.activity, this.smoke, this.rain]) {
      this.scene.tweens.killTweensOf(target)
    }
    this.activity.setAlpha(1)
    this.smoke.setY(0)
    this.rain.setAlpha(1)
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

function activityColor(facility: FacilityId): number {
  switch (facility) {
    case 'power':
      return COLORS.cyan
    case 'road':
      return COLORS.amber
    case 'clinic':
      return COLORS.green
    case 'plaza':
      return COLORS.gold
    case 'hq':
    case 'warehouse':
      return COLORS.inkDim
  }
}
