import { TOKEN_APPEARANCES, tokenAppearanceOf } from './token-appearance'

export const TOKEN_ASSET_IDS: readonly string[] = TOKEN_APPEARANCES

export function tokenAssetId(portraitId: string): string {
  return tokenAppearanceOf(portraitId)
}

export function tokenTextureKey(portraitId: string): string {
  return `token/${tokenAssetId(portraitId)}`
}
