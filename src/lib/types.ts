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

/** One class of a person's work, after self-appearances are set aside. */
export interface CreditGroup {
  /** Work that exists, newest first. */
  released: CreditItem[];
  /** How many credits were withheld as self-appearances. Reported, never silently dropped. */
  asSelf: number;
}

export interface Filmography {
  films: CreditGroup;
  series: CreditGroup;
  /**
   * Announced work of both kinds, soonest first, kept in one section rather than split
   * across the two above. It runs to a handful of rows, and giving it its own pair of
   * headings would spend page structure on the least certain material.
   */
  announced: CreditItem[];
}

/**
 * TMDB credits a talk-show appearance exactly as it credits an acting role, and for a
 * working actor those appearances are most of the television list — 63 of Scarlett
 * Johansson's 72 series credits, 42 of Bryan Cranston's 107. The one thing that separates
 * them is the character: appearing as oneself is credited `Self`, `Self - Guest`, `Himself`.
 *
 * **Rejected: also dropping series with fewer than two episodes**, which was the other half
 * of this rule as originally proposed. Measured against real data it deleted Cranston in
 * *Babylon 5* and *3rd Rock from the Sun* and Elijah Wood in *Frasier* and *Homicide* — a
 * one-episode guest role is still a role, and an anthology lead appears exactly once. It
 * also turned out to be unnecessary: the self test alone takes Johansson's 72 series
 * credits to 9.
 */
function isSelfAppearance(credit: CreditItem): boolean {
  const character = (credit.character ?? "").trim().toLowerCase();
  return /^self\b/.test(character) || /^(him|her|them)self\b/.test(character);
}

/** Newest first, with undated work last — unknown is not the same as forthcoming. */
function byRecency(credits: CreditItem[]): CreditItem[] {
  const dated = credits.filter((c) => creditDate(c));
  const undated = credits.filter((c) => !creditDate(c));

  dated.sort((a, b) => (creditDate(b) ?? "").localeCompare(creditDate(a) ?? ""));
  // Undated credits have no date to sort on, so rating volume is the only signal available.
  undated.sort((a, b) => b.vote_count - a.vote_count);

  return [...dated, ...undated];
}

/**
 * TMDB returns one flat array holding every kind of credit a person has: films and series
 * mixed together, announced projects beside finished ones, press appearances beside acting
 * work, and the same title repeated when someone played more than one part in it.
 *
 * **Films and series are separated** because they are different commitments and the app
 * calls them different things everywhere else. **Released and announced are separated**
 * because rendering a 2028 announcement identically to a 1994 film quietly implies it
 * exists — Scarlett Johansson's page used to open on five films that do not.
 */
export function filmography(credits: CreditItem[]): Filmography {
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
  const films: CreditItem[] = [];
  const series: CreditItem[] = [];
  const announced: CreditItem[] = [];
  let filmsAsSelf = 0;
  let seriesAsSelf = 0;

  for (const credit of seen.values()) {
    if (isSelfAppearance(credit)) {
      if (credit.media_type === "movie") filmsAsSelf++;
      else seriesAsSelf++;
      continue;
    }

    const date = creditDate(credit);
    if (date && date > today) announced.push(credit);
    else if (credit.media_type === "movie") films.push(credit);
    else series.push(credit);
  }

  announced.sort((a, b) => (creditDate(a) ?? "").localeCompare(creditDate(b) ?? ""));

  return {
    films: { released: byRecency(films), asSelf: filmsAsSelf },
    series: { released: byRecency(series), asSelf: seriesAsSelf },
    announced,
  };
}

export function lifespan(person: PersonDetail): string | null {
  const born = year(person.birthday);
  const died = year(person.deathday);
  if (born && died) return `${born}–${died}`;
  if (born) return `b. ${born}`;
  return null;
}
