const ASSET_GLOB = import.meta.glob('../../assets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export interface SceneAsset {
  key: string
  url: string
}

export function textureKey(kind: string, id: string): string {
  return `${kind}/${id}`
}

function keyOfPath(path: string): string {
  const marker = 'assets/'
  const index = path.lastIndexOf(marker)
  const rel = index >= 0 ? path.slice(index + marker.length) : path
  return rel.replace(/\.png$/, '')
}

export function sceneAssets(): SceneAsset[] {
  return Object.entries(ASSET_GLOB).map(([path, url]) => ({ key: keyOfPath(path), url }))
}
