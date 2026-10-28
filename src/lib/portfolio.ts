// Batch 5 (research pattern 7, design.md build spec): the portfolio shows one set per
// shoot, captioned by town, never by street address. Images with no shoot form one set.

export type ShootGroup<T> = {
  key: string;
  shoot: string | null;
  town: string | null;
  images: T[];
};

const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Groups in first-seen order (callers pass images already sorted); ungrouped ones last. */
export function groupByShoot<T extends { shoot: string | null; town: string | null }>(images: T[]): ShootGroup<T>[] {
  const groups = new Map<string, ShootGroup<T>>();
  const ungrouped: T[] = [];

  for (const image of images) {
    const shoot = image.shoot?.trim();
    if (!shoot) {
      ungrouped.push(image);
      continue;
    }
    const id = normalise(shoot);
    let group = groups.get(id);
    if (!group) {
      group = { key: `shoot:${shoot.replace(/\s+/g, " ")}`, shoot: shoot.replace(/\s+/g, " "), town: null, images: [] };
      groups.set(id, group);
    }
    group.town ??= image.town?.trim() || null;
    group.images.push(image);
  }

  const result = Array.from(groups.values());
  // The ungrouped set can mix towns, so it gets no town caption of its own.
  if (ungrouped.length) result.push({ key: "ungrouped", shoot: null, town: null, images: ungrouped });
  return result;
}

/** "[Shoot], [Town]", or whichever of the two exists. */
export function shootCaption(shoot: string | null, town: string | null) {
  const parts = [shoot?.trim(), town?.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
