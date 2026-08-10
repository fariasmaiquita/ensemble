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
  /**
   * The most recent episode to have gone out, anywhere in the run. `null` before a series
   * has broadcast anything.
   *
   * This is the only field on the response that says where the airing has actually reached,
   * and it costs nothing — see `airedInSeason`, which is built entirely on it.
   */
  last_episode_to_air: EpisodeMarker | null;
  next_episode_to_air: EpisodeMarker | null;
}

export interface EpisodeMarker {
  season_number: number;
  episode_number: number;
  air_date: string | null;
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

/** A series that may still gain episodes. The roll-up refuses to call either one finished. */
export function isOpenEnded(standing: SeriesStanding): boolean {
  return standing === "running" || standing === "upcoming";
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
/* Episodes                                                                    */
/* -------------------------------------------------------------------------- */

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  /** TMDB's own marker: `standard`, `finale`, `mid_season`. */
  episode_type?: string;
}

export interface SeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_path: string | null;
  episodes: Episode[];
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether an episode exists yet.
 *
 * An episode with no air date at all counts as unaired: TMDB knows it is coming and does not
 * know when, which is not the same as it having quietly happened.
 */
export function hasAired(episode: Episode, on: string = today()): boolean {
  return episode.air_date !== null && episode.air_date <= on;
}

/**
 * How many episodes of a season have actually gone out.
 *
 * `episode_count` is the number of episodes TMDB has *announced*, which is not the same
 * number and must never be used in its place — measured, not assumed: on 2026-08-10 Lioness
 * season 3 reported eight episodes with two broadcast.
 *
 * `last_episode_to_air` is the whole answer, and it is already on the series response. Where
 * the airing has reached tells you everything: seasons before it are complete, seasons after
 * it have not started, and the season it falls in has aired exactly that many.
 *
 * **Rejected: inferring it from air dates.** A season only carries its *premiere* date, so
 * the first attempt vouched for any season whose successor existed and whose own date had
 * passed. It was wrong on real data in both directions — it vouched for Silo's third season
 * while four of its ten episodes were still to come, because an announced fourth season made
 * the third look settled; and refusing to vouch for the newest season of a running show
 * withheld Reacher's third, which finished in March 2025. A premiere date cannot tell you
 * when a run ended, and no amount of arithmetic over premiere dates fixes that.
 */
export function airedInSeason(season: Season, last: EpisodeMarker | null): number {
  if (!last) return 0;
  if (season.season_number < last.season_number) return season.episode_count;
  if (season.season_number > last.season_number) return 0;
  return Math.min(last.episode_number, season.episode_count);
}

/**
 * Whether each season numbers its episodes from 1, or the series numbers straight through.
 *
 * **Most shows restart; some do not, and assuming it is a bug.** One Piece's twenty-first
 * season holds 197 episodes numbered **892 to 1088**, so anything that generates `1..197`
 * for it writes 197 episode numbers that season does not contain.
 *
 * The test costs one comparison against data already on the response: if the most recent
 * episode's number fits inside its own season's count, seasons restart. Checked against One
 * Piece (S23E1173 in a 26-episode season → straight through), Breaking Bad (S5E16 of 16),
 * Lioness (S3E2 of 8) and The Simpsons (S37E15 of 15).
 */
export function seasonsRestartNumbering(series: TvDetail): boolean {
  const last = series.last_episode_to_air;
  if (!last) return true;
  const own = series.seasons.find((s) => s.season_number === last.season_number);
  return !own || last.episode_number <= own.episode_count;
}

/**
 * Every season with something to tick, counted by what exists rather than what is announced.
 *
 * This is what the roll-up, the Finished control and "everything before" all work from, so
 * none of them can reach an episode that has not been broadcast. A series still in
 * production is additionally capped at "watching" by `derivedStatus` — the census says what
 * exists, and the cap says that having seen all of it is still not finishing it.
 *
 * `numbers` is the aired episode numbers where the app actually knows them, and is **absent
 * rather than guessed** on a series that numbers straight through. Anything that writes
 * episodes reads `numbers` and skips a season that has none, so a show like One Piece loses
 * the bulk shortcuts rather than gaining 197 fabricated ticks.
 */
export function seasonCensus(series: TvDetail): SeasonCensus[] {
  const restarts = seasonsRestartNumbering(series);

  return series.seasons
    .map((season) => {
      const episodes = airedInSeason(season, series.last_episode_to_air);
      return {
        season: season.season_number,
        episodes,
        numbers: restarts
          ? Array.from({ length: episodes }, (_, i) => i + 1)
          : undefined,
      };
    })
    .filter((entry) => entry.episodes > 0);
}

export interface SeasonCensus {
  season: number;
  /** How many episodes have aired. */
  episodes: number;
  /** The aired episode numbers, when the app holds them rather than assuming them. */
  numbers?: number[];
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * `2008-01-20` as `20 Jan 2008`.
 *
 * Split rather than passed to `Date`, deliberately: `new Date("2008-01-20")` is parsed as
 * UTC midnight and then rendered in the reader's zone, so anyone west of Greenwich sees an
 * air date one day early. The string TMDB sends is already the date in words.
 */
export function formatDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-");
  const month = MONTHS[Number(m) - 1];
  if (!y || !month || !d) return date;
  return `${Number(d)} ${month} ${y}`;
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

export function seriesHref(id: number, name: string): string {
  return `/series/${id}-${slugify(name)}`;
}

/**
 * `/series/1396-breaking-bad/season/2`.
 *
 * The season keeps its bare number rather than taking a slug of its own: TMDB names most
 * seasons "Season 2", so a slug would read `/season/2-season-2`. Specials are season 0 and
 * survive that numbering unchanged.
 */
export function seasonHref(id: number, name: string, season: number): string {
  return `${seriesHref(id, name)}/season/${season}`;
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

/**
 * The best-known work in a group, for the preview a section shows before handing off to its
 * full page.
 *
 * **The full list stays chronological; only the preview is ordered this way**, and each is
 * labelled where it appears. Ordering the whole filmography by popularity is what #17
 * rejected — it turns a career into a greatest-hits list with no shape. But a *chronological*
 * preview has a failure of its own that only showed up once real data was in front of it:
 * the newest twelve of Samuel L. Jackson's 190 films are recent contract work and a Super
 * Bowl halftime show, and Pulp Fiction is not among them.
 *
 * Rating volume rather than rating average, deliberately: this is a question about how
 * widely seen something is, not how good it is, and the app takes no position on the second.
 */
export function bestKnown(credits: CreditItem[], count: number): CreditItem[] {
  return [...credits]
    .sort(
      (a, b) =>
        b.vote_count - a.vote_count ||
        (creditDate(b) ?? "").localeCompare(creditDate(a) ?? ""),
    )
    .slice(0, count);
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
