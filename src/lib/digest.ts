/**
 * What the app has to ask the world about the titles in your library.
 *
 * The library is `localStorage` (#3), so it exists only in the browser; TMDB is server-only
 * (#4), so it can only be reached from the server. Everything on the home page sits on the
 * join between the two, and this file is that join's vocabulary — the shape the browser
 * sends up and the shape it gets back.
 *
 * **Nothing here is ever stored.** It is the world's data, held for the length of a page
 * view, which is the same boundary #32 draws from the other side when it lets a *label* be
 * copied into the library but never an answer.
 */

import type { SeasonCensus, SeriesStanding } from "./types";

/* -------------------------------------------------------------------------- */
/* The request                                                                 */
/* -------------------------------------------------------------------------- */

export interface DigestRequest {
  films: number[];
  series: number[];
}

/* -------------------------------------------------------------------------- */
/* The response                                                                */
/* -------------------------------------------------------------------------- */

export interface SeriesFacts {
  standing: SeriesStanding;
  /** Whether it may still gain episodes, which caps the roll-up — see #39. */
  openEnded: boolean;
  /**
   * Every season with something aired in it.
   *
   * #38 recorded that the home page would need this and did not have one, and treated it as
   * an open cost. It turned out to be free: `seasonCensus` and `seriesStanding` read the
   * *same* `/tv/{id}` response, and two of this page's sections need the standing regardless.
   */
  census: SeasonCensus[];
}

export interface FranchisePart {
  id: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  /** Announced entries exist in TMDB's collection and have not come out — see #17. */
  released: boolean;
}

export interface FranchiseFacts {
  id: number;
  name: string;
  /** Release order, announced entries last. */
  parts: FranchisePart[];
}

export interface LibraryDigest {
  /** Keyed by series id, as a string, because that is what JSON gives back. */
  series: Record<string, SeriesFacts>;
  /** Film id → the id of the franchise it belongs to. Most films belong to none. */
  filmFranchise: Record<string, number>;
  franchises: Record<string, FranchiseFacts>;
  /**
   * Titles the server could not resolve — a deleted TMDB entry, an id merged into another,
   * a request that failed.
   *
   * Reported rather than dropped, on the same obligation as #23's withheld-credit count and
   * #43's unfillable notice: a section that quietly renders fewer rows than your library
   * holds is indistinguishable from a broken one.
   */
  unresolved: string[];
}

export const EMPTY_DIGEST: LibraryDigest = {
  series: {},
  filmFranchise: {},
  franchises: {},
  unresolved: [],
};

/* -------------------------------------------------------------------------- */
/* Reading it                                                                  */
/* -------------------------------------------------------------------------- */

export function seriesFacts(
  digest: LibraryDigest,
  id: number,
): SeriesFacts | undefined {
  return digest.series[String(id)];
}

export function franchiseOf(
  digest: LibraryDigest,
  filmId: number,
): FranchiseFacts | undefined {
  const franchiseId = digest.filmFranchise[String(filmId)];
  return franchiseId === undefined ? undefined : digest.franchises[String(franchiseId)];
}
