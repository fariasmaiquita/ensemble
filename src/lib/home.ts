/**
 * What the home page has to say about your library.
 *
 * Every section here is computed from **your data joined to the world's** — which is the
 * whole of the sorting rule settled for this page: a section built from what you have done
 * is in, a section built from what everyone else is doing is out. Trending, popular, top
 * rated, now playing and box office are not deferred, they are refused, because #1 puts
 * Ensemble in the business of showing the shape of what *you* watch and a storefront row is
 * the thing that makes every tracker the same tracker.
 *
 * Pure functions over a `Library` and a `LibraryDigest`, deliberately: this is the logic
 * that decides what the page says, and it should be checkable without a browser.
 */

import {
  type Library,
  type LibraryEntry,
  type WatchStatus,
  SPECIALS_SEASON,
  derivedStatus,
  effectiveStatus,
  seriesProgress,
  watchedCount,
  watchedInSeason,
} from "./library";
import {
  type FranchiseFacts,
  type FranchisePart,
  type LibraryDigest,
  franchiseOf,
  seriesFacts,
} from "./digest";
import type { SeasonCensus } from "./types";

/* -------------------------------------------------------------------------- */
/* Series                                                                      */
/* -------------------------------------------------------------------------- */

export interface SeriesRow {
  entry: LibraryEntry;
  status: WatchStatus | null;
  /** Episodes aired, specials excluded. */
  aired: number;
  /** Episodes you have ticked, specials excluded. */
  watched: number;
  /** Seasons with something in them, specials excluded — the other half of "how much is there". */
  seasons: number;
  /**
   * The earliest aired episode you have not ticked, where the app can name it.
   *
   * `null` on a series that numbers its episodes straight through, because the census
   * withholds the numbers rather than inventing them (#43) — the same limitation that stops
   * the Finished control filling One Piece, surfacing in a second place. The counts are
   * still right there, so the row degrades to a number rather than to nothing.
   */
  nextUp: { season: number; episode: number } | null;
}

/** How far through a series you are, counted against what has actually gone out. */
function measure(library: Library, entry: LibraryEntry, census: SeasonCensus[]) {
  const real = census.filter((season) => season.season !== SPECIALS_SEASON);
  const aired = real.reduce((total, season) => total + season.episodes, 0);

  // Clamped: a hand-edited file can hold more ticks than the series has episodes, and a
  // negative "left to watch" would read as a bug in the arithmetic rather than in the file.
  const watched = Math.min(watchedCount(library, entry.id), aired);

  return { aired, watched, seasons: real.length };
}

/**
 * The first episode you have not seen, walking seasons in order.
 *
 * Specials are skipped on the way through: they never gate finishing a series (#42), so
 * pointing someone at a Christmas episode as the next thing to watch would be the same
 * mistake in the opposite direction.
 */
function nextUnwatched(
  library: Library,
  seriesId: number,
  census: SeasonCensus[],
): { season: number; episode: number } | null {
  const ordered = [...census]
    .filter((season) => season.season !== SPECIALS_SEASON)
    .sort((a, b) => a.season - b.season);

  for (const season of ordered) {
    if (!season.numbers) return null;
    const watched = new Set(watchedInSeason(library, seriesId, season.season));
    const next = season.numbers.find((episode) => !watched.has(episode));
    if (next !== undefined) return { season: season.season, episode: next };
  }

  return null;
}

/** Every series in the library, with the two claims about it already reconciled. */
function seriesRows(library: Library, digest: LibraryDigest): SeriesRow[] {
  const rows: SeriesRow[] = [];

  for (const entry of Object.values(library.entries)) {
    if (entry.kind !== "series") continue;

    const facts = seriesFacts(digest, entry.id);
    if (!facts) continue;

    const progress = seriesProgress(library, entry.id);
    const derived = derivedStatus(progress, facts.census, facts.openEnded);
    const { aired, watched, seasons } = measure(library, entry, facts.census);

    rows.push({
      entry,
      status: effectiveStatus(entry.status, derived),
      aired,
      watched,
      seasons,
      nextUp: nextUnwatched(library, entry.id, facts.census),
    });
  }

  return rows;
}

/** Most recently touched first — `updatedAt`, which #32 is careful never to move on a visit. */
function byRecency(rows: SeriesRow[]): SeriesRow[] {
  return [...rows].sort((a, b) => b.entry.updatedAt.localeCompare(a.entry.updatedAt));
}

/**
 * Series you are in the middle of and have something left to watch.
 *
 * **The membership test is the effective status, not the claimed one**, so a series you
 * never labelled but have ticked six episodes of belongs here — which is the point of #38's
 * roll-up existing at all. A series you *claimed* to have finished is excluded even when the
 * grid disagrees, because on a straight-through-numbered show the Finished control cannot
 * fill the grid (#43) and this section would otherwise offer you episode one of a series you
 * just said you had completed.
 */
export function continueWatching(library: Library, digest: LibraryDigest): SeriesRow[] {
  return byRecency(
    seriesRows(library, digest).filter((row) => row.status === "watching" && row.watched < row.aired),
  );
}

/**
 * Series you are level with and that are going to give you more.
 *
 * This is the other half of the same set, and the split is what makes either half worth
 * having: a series still in production is capped at *Watching* however much of it you have
 * seen (#39), so without the split someone caught up on six running shows opens the app to
 * six rows offering nothing to watch. Here the same fact is the news — you are up to date,
 * and it is coming back.
 *
 * **Narrower than "still running", which is what the section was scoped as.** A running
 * series you have not started answers no question a viewer is asking; it is neither
 * something to continue nor something to wait for. Worth reversing if it reads as a loss.
 */
export function caughtUp(library: Library, digest: LibraryDigest): SeriesRow[] {
  return byRecency(
    seriesRows(library, digest).filter((row) => {
      const facts = seriesFacts(digest, row.entry.id);
      return (
        row.status === "watching" &&
        row.aired > 0 &&
        row.watched >= row.aired &&
        (facts?.openEnded ?? false)
      );
    }),
  );
}

/**
 * Series in your library that were cut off, and that you have not started.
 *
 * The single fact this whole app was partly built to surface (#15), aimed at the one moment
 * it changes a decision. **Once you have started, the warning has expired** — you already
 * know what you are in, and telling you again is a reproach rather than information.
 *
 * Rejected: every cancelled series in the library regardless of progress. It is the larger
 * and less useful set, and it would put a show you are three seasons into under a heading
 * that reads as advice not to begin it.
 */
export function cancelledUnstarted(
  library: Library,
  digest: LibraryDigest,
): SeriesRow[] {
  return byRecency(
    seriesRows(library, digest).filter((row) => {
      const facts = seriesFacts(digest, row.entry.id);
      return (
        facts?.standing === "cancelled" && (row.status === null || row.status === "want")
      );
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Franchises                                                                  */
/* -------------------------------------------------------------------------- */

export interface FranchiseRow {
  franchise: FranchiseFacts;
  /** Released entries you have marked watched. */
  seen: number;
  /** Released entries in the franchise. Announced ones are counted separately. */
  released: number;
  /** Announced entries, which are not something you have failed to watch. */
  announced: number;
  /** The earliest released entry you have not seen — the actionable one. */
  next: FranchisePart | null;
}

/**
 * Franchises you are partway through.
 *
 * This is the section that exists in no competitor, and it is the clearest thing the app
 * does with the join between your data and the world's: the library knows you watched
 * *Alien* and *Aliens*, TMDB knows there are four more, and neither of them knows you are
 * two films into a run.
 *
 * **The denominator is released entries.** An announced sequel is not something you have
 * failed to watch (#17), and counting it would leave a franchise permanently unfinishable —
 * you would be "3 of 4" on a fourth film that does not exist yet, forever.
 */
export function partwayFranchises(
  library: Library,
  digest: LibraryDigest,
): FranchiseRow[] {
  const watchedFilms = new Set<number>();
  for (const entry of Object.values(library.entries)) {
    if (entry.kind === "film" && entry.status === "watched") watchedFilms.add(entry.id);
  }

  const franchises = new Map<number, FranchiseFacts>();
  for (const id of watchedFilms) {
    const franchise = franchiseOf(digest, id);
    if (franchise) franchises.set(franchise.id, franchise);
  }

  const rows: FranchiseRow[] = [];

  for (const franchise of franchises.values()) {
    const released = franchise.parts.filter((part) => part.released);
    const seen = released.filter((part) => watchedFilms.has(part.id)).length;

    // Nothing seen is not "partway", and everything seen is not either. A single-film
    // "franchise" — TMDB files plenty — can never be partway and drops out here.
    if (seen === 0 || seen >= released.length) continue;

    rows.push({
      franchise,
      seen,
      released: released.length,
      announced: franchise.parts.length - released.length,
      next: released.find((part) => !watchedFilms.has(part.id)) ?? null,
    });
  }

  /*
   * Closest to finishing first.
   *
   * Rejected: most recently updated, which is how every other section here is ordered. A
   * franchise is not something you touched at a moment — it is a run with an end, and the
   * one you have two films left of is a more useful thing to be shown than the one you have
   * seven left of. Ties break on the longer run, which is the more interesting of two equals.
   */
  return rows.sort(
    (a, b) => a.released - a.seen - (b.released - b.seen) || b.released - a.released,
  );
}
