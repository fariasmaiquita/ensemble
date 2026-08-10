/**
 * The faces that recur across the things you love.
 *
 * This is the app's whole thesis in one section (#1): not a list of what you watched, but a
 * shape you could not have seen without the list. It is also the section that cannot be
 * server-rendered, and #30 said so before it was built — the server does not know your
 * favourites while it renders, and the alternative was caching every cast list into your
 * library, which would put a frozen copy of TMDB's data into your own export file.
 *
 * The counting is pure and lives here; the fetching is the route handler's problem.
 */

import type { CastMember } from "./types";
import type { TitleKind } from "./library";

/**
 * One appearance: which of your favourites, and as whom.
 *
 * **It carries no title**, deliberately. The browser already holds the label for every
 * favourite — that is the one thing #32 copies into the library and the reason it does — so
 * sending it up to have it sent straight back would make the request bigger to tell the
 * server something it does not use.
 */
export interface FaceTitle {
  kind: TitleKind;
  id: number;
  /** What they were called in it. The words are the content — see #16. */
  character: string;
}

export interface Face {
  id: number;
  name: string;
  profilePath: string | null;
  /** The favourites they appear in, in the order the favourites were given. */
  titles: FaceTitle[];
}

/** One favourite and the people in it. */
export interface CreditedTitle {
  kind: TitleKind;
  id: number;
  cast: CastMember[];
}

/**
 * People who appear in more than one of your favourites, most-shared first.
 *
 * **Nothing is truncated on the way in.** The obvious economy is to count only the top-billed
 * dozen of each title, and it is wrong in the specific way that would empty the section of
 * its best results: a recurring character actor is exactly who sits at position thirteen, and
 * is exactly the person this feature exists to surface. The same argument the app already
 * makes about the cast list holds here, one step further along.
 *
 * Ties break on billing rather than alphabetically, so at equal counts a lead outranks a
 * one-scene player. Someone credited twice in the same title — a dual role — counts once.
 */
export function commonFaces(titles: CreditedTitle[], limit = 12): Face[] {
  const faces = new Map<number, Face & { billing: number }>();

  for (const title of titles) {
    const seenHere = new Set<number>();

    for (const member of title.cast) {
      if (seenHere.has(member.id)) continue;
      seenHere.add(member.id);

      const existing = faces.get(member.id);
      const appearance: FaceTitle = {
        kind: title.kind,
        id: title.id,
        character: member.character,
      };

      if (existing) {
        existing.titles.push(appearance);
        existing.billing = Math.min(existing.billing, member.order);
        // A profile picture on any one of the credits is better than none on the first.
        existing.profilePath ??= member.profile_path;
      } else {
        faces.set(member.id, {
          id: member.id,
          name: member.name,
          profilePath: member.profile_path,
          titles: [appearance],
          billing: member.order,
        });
      }
    }
  }

  return [...faces.values()]
    .filter((face) => face.titles.length > 1)
    .sort((a, b) => b.titles.length - a.titles.length || a.billing - b.billing)
    .slice(0, limit)
    .map((face) => ({
      id: face.id,
      name: face.name,
      profilePath: face.profilePath,
      titles: face.titles,
    }));
}
