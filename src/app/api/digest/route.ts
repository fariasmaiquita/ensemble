import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";
import {
  type CollectionDetail,
  type MovieDetail,
  type TvDetail,
  inReleaseOrder,
  isOpenEnded,
  seasonCensus,
  seriesStanding,
  today,
  year,
} from "@/lib/types";
import {
  type DigestRequest,
  type FranchiseFacts,
  type LibraryDigest,
  type SeriesFacts,
} from "@/lib/digest";

/**
 * The one place the browser can ask about the titles it is holding.
 *
 * Every TMDB call in this app runs on the server (#4) and the library only exists in the
 * browser (#3), so the home page's sections cannot be rendered by either side alone. This
 * route is the seam: the browser posts the ids it has, and gets back the facts about them
 * that no amount of stored data could supply.
 *
 * **One request rather than one per title.** The server still makes N calls to TMDB, so the
 * saving is not in TMDB's cost — it is that the browser waits once instead of N times, and
 * that Next's fetch cache means a second visitor asking about Alien pays nothing. The
 * rejected shape was a `/api/series/[id]` the client would fan out over, which is simpler to
 * write and turns a page load into forty round trips over one connection.
 *
 * **POST rather than GET**, despite this being a read. A library of a hundred titles is a
 * query string of a thousand characters, and the response is per-user by definition, so
 * there is no shared cache entry to win by making it addressable.
 */

/** How many TMDB requests to have in flight at once. */
const CONCURRENCY = 8;

/** Refuse absurd input rather than fanning out on it. */
const MAX_TITLES = 300;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const { films, series } = parseRequest(body);
  if (films.length + series.length > MAX_TITLES) {
    return NextResponse.json({ error: "Too many titles." }, { status: 413 });
  }

  const digest: LibraryDigest = {
    series: {},
    filmFranchise: {},
    franchises: {},
    unresolved: [],
  };

  /*
   * A title that fails is recorded by name and the rest of the page carries on.
   *
   * The alternative — one rejected promise failing the whole request — makes a single
   * deleted TMDB entry blank a home page. Since the library is the one thing in this app
   * that cannot be re-fetched from anywhere, that is the worst possible thing to be fragile
   * about.
   */
  await inBatches(series, CONCURRENCY, async (id) => {
    try {
      const detail = await tmdb<TvDetail>(`/tv/${id}`);
      digest.series[String(id)] = factsFor(detail);
    } catch {
      digest.unresolved.push(`series:${id}`);
    }
  });

  const collections = new Map<number, string>();

  await inBatches(films, CONCURRENCY, async (id) => {
    try {
      const detail = await tmdb<MovieDetail>(`/movie/${id}`);
      const collection = detail.belongs_to_collection;
      if (collection) {
        digest.filmFranchise[String(id)] = collection.id;
        collections.set(collection.id, collection.name);
      }
    } catch {
      digest.unresolved.push(`film:${id}`);
    }
  });

  /*
   * The second hop, and the reason this route exists rather than a per-title one.
   *
   * A film's own response says *which* franchise it belongs to but not what else is in it,
   * so "you have seen 2 of 4 Alien films" needs a request the client could not have known to
   * make until the first round came back. Distinct collections only — six Alien films in
   * your library are one lookup, not six.
   */
  await inBatches([...collections.keys()], CONCURRENCY, async (id) => {
    try {
      const detail = await tmdb<CollectionDetail>(`/collection/${id}`);
      digest.franchises[String(id)] = partsFor(detail);
    } catch {
      digest.unresolved.push(`franchise:${id}`);
    }
  });

  return NextResponse.json(digest);
}

function factsFor(detail: TvDetail): SeriesFacts {
  const standing = seriesStanding(detail.status);
  return {
    standing,
    openEnded: isOpenEnded(standing),
    census: seasonCensus(detail),
  };
}

function partsFor(detail: CollectionDetail): FranchiseFacts {
  const now = today();

  return {
    id: detail.id,
    name: detail.name,
    parts: inReleaseOrder(detail.parts).map((part) => ({
      id: part.id,
      title: part.title,
      year: year(part.release_date),
      posterPath: part.poster_path,
      // No date at all means TMDB knows a film is coming and not when, which is not the
      // same as it having quietly come out — the same reading `hasAired` takes of episodes.
      released: Boolean(part.release_date) && (part.release_date ?? "") <= now,
    })),
  };
}

/** Ids only, deduplicated, and nothing that is not a positive integer. */
function parseRequest(body: unknown): DigestRequest {
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  return { films: parseIds(raw.films), series: parseIds(raw.series) };
}

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  for (const id of value) {
    if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

/**
 * Run `work` over every item, `size` at a time.
 *
 * Unbounded `Promise.all` over a library of a hundred titles opens a hundred sockets at
 * once and invites TMDB to start refusing them, which would turn a large library into the
 * one that works least well.
 */
async function inBatches<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(work));
  }
}
