import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";
import type { Credits } from "@/lib/types";
import { type CreditedTitle, commonFaces } from "@/lib/faces";

/**
 * Cast lists for your favourites, folded into the people who appear in more than one.
 *
 * **Its own route rather than a field on the digest**, and that is a design decision rather
 * than a filing one. This is the slowest thing the home page asks for — a request per
 * favourite, against the digest's one round trip — and folding it in would make the entire
 * page wait on the section that takes longest. Separated, the library sections are on screen
 * while this one is still arriving, and it gets the designed waiting state #30 promised it
 * when it accepted that this could never be server-rendered.
 *
 * The counting itself is pure and lives in `faces.ts`; this file only fetches.
 */

const CONCURRENCY = 6;

/** Beyond this the fan-out costs more than the section is worth on one page load. */
const MAX_FAVOURITES = 40;

interface Body {
  films?: unknown;
  series?: unknown;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const films = parseIds(body.films).slice(0, MAX_FAVOURITES);
  const series = parseIds(body.series).slice(0, MAX_FAVOURITES - films.length);

  const titles: CreditedTitle[] = [];

  await inBatches(
    [
      ...films.map((id) => ({ kind: "film" as const, id })),
      ...series.map((id) => ({ kind: "series" as const, id })),
    ],
    CONCURRENCY,
    async ({ kind, id }) => {
      const path = kind === "film" ? `/movie/${id}` : `/tv/${id}`;
      try {
        const credits = await tmdb<Credits>(`${path}/credits`);
        titles.push({ kind, id, cast: credits.cast ?? [] });
      } catch {
        // A favourite whose cast cannot be fetched contributes nothing rather than failing
        // the section. Unlike the digest, there is nothing to report: a face missing from a
        // count is not a row silently removed from a list of your own titles.
      }
    },
  );

  return NextResponse.json({ faces: commonFaces(titles) });
}

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  for (const id of value) {
    if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

async function inBatches<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}
