import Phaser from 'phaser'
import { reducedMotion } from '../../store'
import { COLORS } from '../tokens'
import type { FxEntry } from '../town/fx-map'
import {
  FACILITY_PLOTS,
  footprintDiamond,
  type FacilityId,
  type FacilityPlot,
} from '../town/layout'
import { pixelText } from '../ui/pixel-text'

export class TownPlaybackFx extends Phaser.GameObjects.Container {
  private readonly focus: Phaser.GameObjects.Graphics
  private focusedFacility: FacilityId | null = null
  private focusColor: number = COLORS.cyan

  constructor(scene: Phaser.Scene) {
    super(scene)
    this.focus = scene.add.graphics()
    this.add(this.focus)
    this.setDepth(180)
    scene.add.existing(this)
  }

  setTownTransform(x: number, y: number, scale: number): void {
    this.setPosition(x, y)
    this.setScale(scale)
  }

  setFocus(facility: FacilityId | null, color: number = COLORS.cyan): void {
    if (this.focusedFacility === facility && this.focusColor === color) return
    this.focusedFacility = facility
    this.focusColor = color
    this.redrawFocus()
  }

  play(entry: FxEntry, color: number): void {
    if (reducedMotion() || !entry.facility) return
    const anchor = FACILITY_PLOTS.find((plot) => plot.id === entry.facility)
    if (!anchor) return
    this.pulse(anchor, color, 980)
    if (entry.kind === 'work') this.workBurst(anchor, color)
  }

  playArrival(): void {
    if (reducedMotion()) return
    const road = FACILITY_PLOTS.find((plot) => plot.id === 'road')
    if (!road) return
    this.pulse(road, COLORS.gold, 900)
    const marker = pixelText(this.scene, '到', { fontSize: 18, color: COLORS.gold })
    marker.setPosition(road.x, road.y - 40)
    marker.setOrigin(0.5)
    this.add(marker)
    this.scene.tweens.add({
      targets: marker,
      y: road.y - 66,
      alpha: 0,
      duration: 1100,
      onComplete: () => {
        this.remove(marker)
        marker.destroy()
      },
    })
  }

  private redrawFocus(): void {
    const g = this.focus
    g.clear()
    const focused = this.focusedFacility
    if (!focused) return
    for (const plot of FACILITY_PLOTS) {
      const diamond = pointsToGeom(footprintDiamond(plot.x, plot.y))
      if (plot.id === focused) {
        g.lineStyle(4, this.focusColor, 1)
        g.strokePoints(diamond, true)
      } else {
        g.fillStyle(COLORS.night900, 0.42)
        g.fillPoints(diamond, true)
      }
    }
  }

  private pulse(plot: FacilityPlot, color: number, duration: number): void {
    const ring = this.scene.add.graphics()
    ring.lineStyle(4, color)
    ring.strokePoints(pointsToGeom(footprintDiamond(plot.x, plot.y)), true)
    this.add(ring)
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration,
      onComplete: () => {
        this.remove(ring)
        ring.destroy()
      },
    })
  }

  private workBurst(plot: FacilityPlot, color: number): void {
    const burst = this.scene.add.graphics()
    burst.lineStyle(3, color)
    burst.lineBetween(plot.x - 30, plot.y - 32, plot.x - 18, plot.y - 20)
    burst.lineBetween(plot.x + 30, plot.y - 32, plot.x + 18, plot.y - 20)
    burst.lineBetween(plot.x, plot.y - 44, plot.x, plot.y - 27)
    burst.lineBetween(plot.x - 36, plot.y - 6, plot.x - 22, plot.y - 8)
    burst.lineBetween(plot.x + 36, plot.y - 6, plot.x + 22, plot.y - 8)
    this.add(burst)
    this.scene.tweens.add({
      targets: burst,
      y: -8,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.remove(burst)
        burst.destroy()
      },
    })
  }
}

function pointsToGeom(points: number[]): Phaser.Geom.Point[] {
  const result: Phaser.Geom.Point[] = []
  for (let index = 0; index < points.length; index += 2) {
    result.push(new Phaser.Geom.Point(points[index] ?? 0, points[index + 1] ?? 0))
  }
  return result
}
