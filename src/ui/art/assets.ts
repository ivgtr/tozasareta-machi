import type { ArtKind } from './manifest'

const ASSETS = import.meta.glob('../assets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function resolveArtUrl(kind: ArtKind, id: string): string | undefined {
  const suffix = `/${kind}/${id}.png`
  for (const [path, url] of Object.entries(ASSETS)) {
    if (path.endsWith(suffix)) return url
  }
  return undefined
}
