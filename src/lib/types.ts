/** The subset of TMDB's response shapes this app actually reads. */

export type MediaType = "movie" | "tv" | "person";

export interface Paginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

export interface MovieSummary {
  id: number;
  media_type: "movie";
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
}

export interface TvSummary {
  id: number;
  media_type: "tv";
  name: string;
  original_name?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
}

export interface PersonSummary {
  id: number;
  media_type: "person";
  name: string;
  profile_path: string | null;
  known_for_department?: string;
}

export type MultiSearchResult = MovieSummary | TvSummary | PersonSummary;

/** TMDB omits `media_type` on some endpoints, so narrow defensively rather than by cast. */
export function isMovie(r: MultiSearchResult): r is MovieSummary {
  return r.media_type === "movie";
}

export function isTv(r: MultiSearchResult): r is TvSummary {
  return r.media_type === "tv";
}

export function isPerson(r: MultiSearchResult): r is PersonSummary {
  return r.media_type === "person";
}

/** Display title, which TMDB calls `title` for films and `name` for series. */
export function displayTitle(r: MultiSearchResult): string {
  return isMovie(r) ? r.title : r.name;
}

/** Release year as a string, or null when TMDB has no date (common for unreleased titles). */
export function releaseYear(r: MultiSearchResult): string | null {
  const date = isMovie(r) ? r.release_date : isTv(r) ? r.first_air_date : undefined;
  return date ? date.slice(0, 4) : null;
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

export interface Collection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface MovieDetail {
  id: number;
  title: string;
  original_title: string;
  tagline: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  status: string;
  genres: Genre[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  belongs_to_collection: Collection | null;
  homepage: string;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface TvDetail {
  id: number;
  name: string;
  original_name: string;
  tagline: string;
  overview: string;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  type: string;
  genres: Genre[];
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  created_by: { id: number; name: string }[];
  seasons: Season[];
}

/* -------------------------------------------------------------------------- */
/* Series standing — the distinction the whole app is partly about             */
/* -------------------------------------------------------------------------- */

export type SeriesStanding = "running" | "ended" | "cancelled" | "upcoming" | "unknown";

/**
 * TMDB reports "Ended" and "Canceled" as separate statuses, and almost no tracker surfaces
 * the difference. It is the difference between a story that finished and a story that was
 * cut off mid-sentence — which is exactly what someone deciding whether to start a series
 * needs to know, and the reason this app exists.
 */
export function seriesStanding(status: string): SeriesStanding {
  switch (status) {
    case "Returning Series":
      return "running";
    case "Ended":
      return "ended";
    case "Canceled":
    case "Cancelled":
      return "cancelled";
    case "Planned":
    case "In Production":
    case "Pilot":
      return "upcoming";
    default:
      return "unknown";
  }
}

export function standingLabel(standing: SeriesStanding): string {
  switch (standing) {
    case "running":
      return "Still running";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    case "upcoming":
      return "Not yet aired";
    default:
      return "Status unknown";
  }
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

export function year(date: string | null | undefined): string | null {
  return date ? date.slice(0, 4) : null;
}

/**
 * URLs carry a readable slug after the id — `/film/348-alien` rather than `/film/348` —
 * so a pasted link says what it points at. The id is parsed off the front, so the slug is
 * cosmetic and a stale one still resolves.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // drop the marks NFD just split off
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function parseId(param: string): number | null {
  const id = Number.parseInt(param, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function mediaHref(r: MultiSearchResult): string {
  const slug = slugify(displayTitle(r));
  if (isMovie(r)) return `/film/${r.id}-${slug}`;
  if (isTv(r)) return `/series/${r.id}-${slug}`;
  return `/person/${r.id}-${slug}`;
}
