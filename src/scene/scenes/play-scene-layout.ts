import type Phaser from 'phaser'
import type { CharacterDeck } from '../character/character-deck'
import type { PlacementStatus } from '../planning/placement-status'
import type { HudBar } from '../hud'
import { deviceClassOf, readSafeInsets, toLogicalSafeInsets } from '../layout'
import type { LogDrawer } from '../log-drawer'
import type { CommitConfirmPresentation } from '../planning/commit-confirm-presentation'
import type { FacilityFocus } from '../planning/facility-focus'
import type { PlanningControls } from '../planning/planning-controls'
import { computeRegions, type Regions } from '../regions'
import type { StoryPresentations } from '../story/story-presentations'
import type { PlayTownViewportController } from '../town/play-scene-viewport'
import type { FlowPresentation } from '../playback/flow-presentation'
import type { MenuPresentation } from '../global/menu-presentation'

export interface PlaySceneLayoutContext {
  game: Phaser.Game
  gameSize: { width: number; height: number }
  townMask: Phaser.GameObjects.Graphics
  townViewport: PlayTownViewportController
  hud: HudBar
  controls: PlanningControls
  deck: CharacterDeck
  placementStatus: PlacementStatus
  facilityFocus: FacilityFocus
  log: LogDrawer
  menu: MenuPresentation
  confirm: CommitConfirmPresentation
  story: StoryPresentations
  flow: FlowPresentation
}

export function applyPlaySceneLayout(ctx: PlaySceneLayoutContext): Regions {
  const { width, height } = ctx.gameSize
  const deviceClass = deviceClassOf(window.innerWidth)
  const canvas = ctx.game.canvas.getBoundingClientRect()
  const insets = toLogicalSafeInsets(
    readSafeInsets(),
    window.innerWidth,
    window.innerHeight,
    {
      left: canvas.left,
      top: canvas.top,
      right: canvas.right,
      bottom: canvas.bottom,
      width: canvas.width,
      height: canvas.height,
    },
    width,
    height,
  )
  const regions = computeRegions(deviceClass, width, height, insets)

  ctx.townMask.clear()
  ctx.townMask.fillStyle(0xffffff)
  ctx.townMask.fillRect(regions.town.x, regions.town.y, regions.town.width, regions.town.height)
  ctx.townViewport.reset()
  ctx.hud.setBounds(regions.hud, deviceClass)
  ctx.controls.setBounds(regions.controls, deviceClass)
  ctx.deck.setBounds(
    regions.deck.x,
    regions.deck.y,
    regions.deck.width,
    regions.deck.height,
    deviceClass,
  )
  ctx.placementStatus.setBounds(regions.town, deviceClass)
  ctx.facilityFocus.setBounds(regions.town, deviceClass)
  ctx.log.setAnchor(
    regions.hud.x + 8,
    regions.hud.y + regions.hud.height + 8,
    Math.min(440, regions.hud.width - 16),
  )
  ctx.menu.setViewport(width, height, deviceClass)
  ctx.confirm.setViewport(width, height)
  ctx.story.setViewport(width, height, deviceClass)
  ctx.flow.setViewport(width, height, deviceClass)

  return regions
}
