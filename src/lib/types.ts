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

export function personHref(id: number, name: string): string {
  return `/person/${id}-${slugify(name)}`;
}

/* -------------------------------------------------------------------------- */
/* Franchises (TMDB calls them collections)                                    */
/* -------------------------------------------------------------------------- */

export interface CollectionPart {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
}

export interface CollectionDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: CollectionPart[];
}

/**
 * TMDB names almost every collection "<Something> Collection" — "Alien Collection", "The
 * Lord of the Rings Collection". The suffix is TMDB's filing convention, not part of the
 * franchise's name, and reading "Part of the Alien Collection collection" is the kind of
 * seam that makes an app feel assembled rather than designed.
 *
 * Stripped only when it is actually there, so a collection named something else survives
 * untouched rather than being mangled by a rule that assumed a pattern.
 */
export function franchiseName(name: string): string {
  return name.replace(/\s+Collection$/i, "").trim() || name;
}

export function franchiseHref(id: number, name: string): string {
  return `/franchise/${id}-${slugify(franchiseName(name))}`;
}

/**
 * Franchise entries run in release order — the order they came out, not the order the story
 * happens in.
 *
 * Undated entries (announced sequels TMDB already knows about) sort to the end rather than
 * the start, which is where an empty date string would otherwise put them.
 */
export function inReleaseOrder(parts: CollectionPart[]): CollectionPart[] {
  const dated = parts.filter((p) => p.release_date);
  const undated = parts.filter((p) => !p.release_date);
  dated.sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""));
  return [...dated, ...undated];
}

/* -------------------------------------------------------------------------- */
/* People and credits                                                          */
/* -------------------------------------------------------------------------- */

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
}

/** One entry in a person's filmography. TMDB mixes films and series in the same array. */
export interface CreditItem {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  character?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_count: number;
  episode_count?: number;
}

export interface CombinedCredits {
  cast: CreditItem[];
  crew: (CreditItem & { job?: string })[];
}

export function creditTitle(c: CreditItem): string {
  return c.title ?? c.name ?? "Untitled";
}

export function creditYear(c: CreditItem): string | null {
  return year(c.media_type === "movie" ? c.release_date : c.first_air_date);
}

export function creditHref(c: CreditItem): string {
  const slug = slugify(creditTitle(c));
  return c.media_type === "movie" ? `/film/${c.id}-${slug}` : `/series/${c.id}-${slug}`;
}

function creditDate(c: CreditItem): string | undefined {
  return c.media_type === "movie" ? c.release_date : c.first_air_date;
}

export interface Filmography {
  /** Work that exists, newest first. */
  released: CreditItem[];
  /** Announced but not out yet, soonest first. */
  upcoming: CreditItem[];
}

/**
 * TMDB returns the same title more than once when someone played several roles in it, and
 * mixes announced-but-unreleased projects into the same array as finished work.
 *
 * **Released and upcoming are separated, and released comes first.** A straight
 * reverse-chronological list is honest but useless: Scarlett Johansson's page opened on five
 * films that do not exist yet, pushing everything she is actually known for below the fold.
 * Rendering a 2028 announcement identically to a 1994 film also quietly implies it exists.
 *
 * Undated credits stay at the end of *released* rather than being treated as upcoming — an
 * undated credit is unknown, not forthcoming — and are ordered by how many people have
 * rated them, since that is the only signal available for them.
 */
export function tidyFilmography(credits: CreditItem[]): Filmography {
  const seen = new Map<string, CreditItem>();

  for (const credit of credits) {
    const key = `${credit.media_type}-${credit.id}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, credit);
    } else if ((credit.character?.length ?? 0) > (existing.character?.length ?? 0)) {
      // Keep the more descriptive of two duplicate rows.
      seen.set(key, credit);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const all = [...seen.values()];

  const upcoming = all.filter((c) => {
    const date = creditDate(c);
    return Boolean(date) && date! > today;
  });
  const dated = all.filter((c) => {
    const date = creditDate(c);
    return Boolean(date) && date! <= today;
  });
  const undated = all.filter((c) => !creditDate(c));

  dated.sort((a, b) => (creditDate(b) ?? "").localeCompare(creditDate(a) ?? ""));
  upcoming.sort((a, b) => (creditDate(a) ?? "").localeCompare(creditDate(b) ?? ""));
  undated.sort((a, b) => b.vote_count - a.vote_count);

  return { released: [...dated, ...undated], upcoming };
}

export function lifespan(person: PersonDetail): string | null {
  const born = year(person.birthday);
  const died = year(person.deathday);
  if (born && died) return `${born}–${died}`;
  if (born) return `b. ${born}`;
  return null;
}
