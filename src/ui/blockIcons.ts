import type { BlockType } from '../game/blocks';
import { blockIcon } from '../render/textures';

const cache = new Map<BlockType, string>();

/** Data URL izometrické ikonky kostky (počítá se jednou). */
export function iconFor(t: BlockType): string {
  let url = cache.get(t);
  if (!url) {
    url = blockIcon(t, 112);
    cache.set(t, url);
  }
  return url;
}
