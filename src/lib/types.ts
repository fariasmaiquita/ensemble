/** The subset of TMDB's response shapes this app actually reads. */

export type MediaType = "movie" | "tv" | "person";

export interface Paginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

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
