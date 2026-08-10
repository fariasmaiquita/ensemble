/**
 * The library: everything the app knows about *you*.
 *
 * There is no account and no database (decisions.md #3), so this is the whole of the
 * user's data — one JSON object in `localStorage`, read through React's external-store
 * primitive so that every control on every page reflects the same state, including across
 * browser tabs.
 *
 * Deliberately not `server-only`'s counterpart of a data layer: nothing here touches TMDB.
 * The rule this file exists to hold is that **your data goes in and the world's data stays
 * out** — the same rule that decides what the home page may show.
 */

export type TitleKind = "film" | "series";

/**
 * A film is watched or it is not. A series has a middle: you are three seasons into it and
 * the question "have you seen this" has no yes/no answer. Episode-level progress lands in
 * its own block and will roll up into exactly these three values rather than replace them.
 */
export type WatchStatus = "want" | "watching" | "watched";

/** Which statuses a kind can hold. A film cannot be in progress at this granularity. */
export const STATUSES: Record<TitleKind, readonly WatchStatus[]> = {
  film: ["want", "watched"],
  series: ["want", "watching", "watched"],
};

export function statusLabel(status: WatchStatus, kind: TitleKind): string {
  switch (status) {
    case "want":
      return "Want to watch";
    case "watching":
      return "Watching";
    case "watched":
      return kind === "series" ? "Finished" : "Watched";
  }
}

/**
 * Enough of a title to render a row without asking TMDB.
 *
 * This is the one place the world's data is copied into the user's, and the boundary is
 * narrow on purpose: an identifier and its label, never an answer. Caching a *cast list*
 * here was rejected — see decisions.md #30 — because the app's questions must be computed
 * from live data. Caching the *name of the thing you saved* is what makes an exported file
 * legible to the person who exported it.
 */
export interface TitleRef {
  kind: TitleKind;
  id: number;
  title: string;
  year: string | null;
  posterPath: string | null;
}

export interface LibraryEntry extends TitleRef {
  status: WatchStatus | null;
  favourite: boolean;
  /** ISO date. The home page's "continue watching" ordering will read this. */
  updatedAt: string;
}

/**
 * Which episodes of one series have been watched, keyed by season number.
 *
 * Both levels are keyed by strings because that is what JSON gives back, and pretending
 * otherwise with `Record<number, …>` would be a type that the parser immediately disproves.
 * Values are episode numbers, sorted and unique — `{ "1": [1, 2, 3] }` reads in an export
 * as plainly as it does here, which is the whole reason #3's file has to stay legible.
 */
export type SeriesProgress = Record<string, number[]>;

export interface Library {
  version: 1;
  entries: Record<string, LibraryEntry>;
  /**
   * Episode progress, keyed by series id — its own map beside `entries` rather than a field
   * inside them, exactly as decisions.md #35 committed to.
   *
   * It joins rather than replaces: a series still carries one of three title-level statuses,
   * and this rolls *up* into that value. Keeping it separate is also what lets the schema
   * arrive without a version bump — an older file simply has no `progress`, and a reader
   * that finds none gets an empty map rather than a rejected library.
   */
  progress: Record<string, SeriesProgress>;
}

const STORAGE_KEY = "ensemble:library";
const VERSION = 1;

/**
 * A single frozen empty library, not a fresh object per call.
 *
 * `useSyncExternalStore` compares snapshots by identity and re-renders when they differ, so
 * a getter that builds a new object every time loops forever. Every read path in this file
 * returns either this constant or a cached object.
 */
const EMPTY: Library = Object.freeze({
  version: VERSION,
  entries: {},
  progress: {},
}) as Library;

export function titleKey(kind: TitleKind, id: number): string {
  return `${kind}:${id}`;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

function isStatus(value: unknown): value is WatchStatus {
  return value === "want" || value === "watching" || value === "watched";
}

function isKind(value: unknown): value is TitleKind {
  return value === "film" || value === "series";
}

function parseEntry(key: string, value: unknown): LibraryEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!isKind(raw.kind)) return null;
  if (typeof raw.id !== "number" || !Number.isInteger(raw.id) || raw.id <= 0) return null;
  // The key is derived from the entry, so a mismatch means the file was hand-edited or
  // written by something else. Trusting it would silently detach a row from its own id.
  if (key !== titleKey(raw.kind, raw.id)) return null;

  const status = isStatus(raw.status) ? raw.status : null;
  const favourite = raw.favourite === true;
  // An entry recording neither a status nor a favourite is not a fact about the user.
  if (status === null && !favourite) return null;
  if (status !== null && !STATUSES[raw.kind].includes(status)) return null;

  return {
    kind: raw.kind,
    id: raw.id,
    title: typeof raw.title === "string" && raw.title ? raw.title : "Untitled",
    year: typeof raw.year === "string" && raw.year ? raw.year : null,
    posterPath: typeof raw.posterPath === "string" ? raw.posterPath : null,
    status,
    favourite,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

/**
 * A season's watched episodes: integers, deduplicated, sorted, and nothing else.
 *
 * Episode numbers are allowed to be zero because TMDB genuinely numbers some specials `0`.
 * They are not bounded from above, deliberately — the library has no idea how long a season
 * is, and inventing a ceiling here would mean the parser disagreeing with TMDB about a
 * series it has never seen.
 */
function parseSeason(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;

  const episodes = new Set<number>();
  for (const episode of value) {
    if (typeof episode === "number" && Number.isInteger(episode) && episode >= 0) {
      episodes.add(episode);
    }
  }

  return episodes.size > 0 ? [...episodes].sort((a, b) => a - b) : null;
}

/** A series' seasons. Empty seasons are dropped, and a series left with none is dropped. */
function parseProgress(value: unknown): SeriesProgress | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const seasons: SeriesProgress = {};
  for (const [key, episodes] of Object.entries(value as Record<string, unknown>)) {
    // The key has to survive the round trip through `String(number)`, which rejects "01"
    // and " 2" as well as outright rubbish.
    const season = Number.parseInt(key, 10);
    if (!Number.isInteger(season) || season < 0 || String(season) !== key) continue;

    const parsed = parseSeason(episodes);
    if (parsed) seasons[key] = parsed;
  }

  return Object.keys(seasons).length > 0 ? seasons : null;
}

/**
 * Validation is written here rather than at the import screen because import and page load
 * read the same shape, and a parser that only guards the file-picker leaves the larger
 * surface — a `localStorage` value edited by hand, or left behind by an older build —
 * completely unguarded.
 *
 * Anything unreadable degrades to an empty library rather than throwing. A corrupt row
 * loses one title; a thrown error loses the page.
 */
export function parseLibrary(source: string | null): Library {
  if (!source) return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return EMPTY;
  }

  if (typeof parsed !== "object" || parsed === null) return EMPTY;
  const raw = parsed as Record<string, unknown>;
  if (raw.version !== VERSION) return EMPTY;
  if (typeof raw.entries !== "object" || raw.entries === null) return EMPTY;

  const entries: Record<string, LibraryEntry> = {};
  for (const [key, value] of Object.entries(raw.entries as Record<string, unknown>)) {
    const entry = parseEntry(key, value);
    if (entry) entries[key] = entry;
  }

  /*
   * `progress` is optional rather than required, and that is the whole no-migration
   * promise: every library written before this block has no such key, and reads as a
   * library with no episodes rather than as a library that fails to parse.
   */
  const progress: Record<string, SeriesProgress> = {};
  if (typeof raw.progress === "object" && raw.progress !== null) {
    for (const [key, value] of Object.entries(raw.progress as Record<string, unknown>)) {
      const id = Number.parseInt(key, 10);
      if (!Number.isInteger(id) || id <= 0 || String(id) !== key) continue;

      const seasons = parseProgress(value);
      if (seasons) progress[key] = seasons;
    }
  }

  return { version: VERSION, entries, progress };
}

/* -------------------------------------------------------------------------- */
/* The store                                                                   */
/* -------------------------------------------------------------------------- */

let cache: Library | null = null;
const listeners = new Set<() => void>();

/**
 * Whether this browser is refusing to persist — private mode, a full quota, storage
 * disabled outright.
 *
 * It is tracked because the failure is otherwise **invisible and indistinguishable from
 * success**: the write is synchronous, so a control fills in exactly as it would have, and
 * nothing is written. A console warning is not a user-facing answer. See decisions.md #37.
 */
let blocked = false;

/** Primitive, so it is a stable snapshot for `useSyncExternalStore` without caching. */
export function getStorageBlocked(): boolean {
  return blocked;
}

export function getStorageBlockedServer(): boolean {
  return false;
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  // A `null` key means the whole store was cleared, which is also our business.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cache = null;
  emit();
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): Library {
  if (cache) return cache;
  try {
    cache = parseLibrary(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be unavailable outright — Safari private mode, a blocked third-party
    // context, a user who disabled it. The app still works; it just cannot remember, and
    // it says so rather than letting every control look like it saved.
    blocked = true;
    cache = EMPTY;
  }
  return cache;
}

/**
 * The server has no idea who is asking, so the only honest server snapshot is an empty
 * library. Controls render a neutral state in the HTML and resolve after hydration — see
 * decisions.md #31 for why that is a design problem rather than a technical one.
 */
export function getServerSnapshot(): Library {
  return EMPTY;
}

function write(
  entries: Record<string, LibraryEntry>,
  progress: Record<string, SeriesProgress> = getSnapshot().progress,
) {
  const next: Library = { version: VERSION, entries, progress };
  // The in-memory cache is updated first and unconditionally: if persistence fails, the
  // click the user just made still stands for the rest of the session rather than
  // springing back with no explanation.
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    blocked = false;
  } catch {
    blocked = true;
  }
  emit();
}

/**
 * Entries are created on demand and removed the moment they hold nothing.
 *
 * An entry with no status and no favourite is a row that records the user did nothing,
 * and leaving those behind means an exported file is mostly a list of pages someone
 * happened to open.
 */
function update(ref: TitleRef, change: Partial<Pick<LibraryEntry, "status" | "favourite">>) {
  const key = titleKey(ref.kind, ref.id);
  const entries = { ...getSnapshot().entries };
  const existing = entries[key];

  const status = change.status !== undefined ? change.status : (existing?.status ?? null);
  const favourite =
    change.favourite !== undefined ? change.favourite : (existing?.favourite ?? false);

  if (status === null && !favourite) {
    delete entries[key];
  } else {
    // Display fields come from the ref every time, so the label refreshes whenever the
    // user is on a page that knows the current one.
    entries[key] = { ...ref, status, favourite, updatedAt: new Date().toISOString() };
  }

  write(entries);
}

export function setStatus(ref: TitleRef, status: WatchStatus | null) {
  update(ref, { status });
}

export function toggleFavourite(ref: TitleRef) {
  update(ref, { favourite: !getEntry(getSnapshot(), ref.kind, ref.id)?.favourite });
}

/**
 * Refresh the stored label for a title already in the library, and only when it has
 * actually changed.
 *
 * Called from the detail page, which is the one moment the app is holding both the stored
 * copy and TMDB's current answer. Guarded on a real difference so that opening a page does
 * not write to storage — and, more importantly, does not move `updatedAt`, which would make
 * "recently updated" mean "recently viewed".
 */
export function refreshRef(ref: TitleRef) {
  const key = titleKey(ref.kind, ref.id);
  const existing = getSnapshot().entries[key];
  if (!existing) return;
  if (
    existing.title === ref.title &&
    existing.year === ref.year &&
    existing.posterPath === ref.posterPath
  ) {
    return;
  }

  write({ ...getSnapshot().entries, [key]: { ...existing, ...ref } });
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

export function getEntry(
  library: Library,
  kind: TitleKind,
  id: number,
): LibraryEntry | undefined {
  return library.entries[titleKey(kind, id)];
}

export function favourites(library: Library): LibraryEntry[] {
  return Object.values(library.entries)
    .filter((entry) => entry.favourite)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* -------------------------------------------------------------------------- */
/* Episode progress                                                            */
/* -------------------------------------------------------------------------- */

/** Specials are season 0 in TMDB's numbering, and they never gate finishing a series. */
export const SPECIALS_SEASON = 0;

/**
 * How many episodes each season has, as counted by whichever page is doing the asking.
 *
 * **This is the world's data and it is passed in, never stored** — the same boundary #32
 * draws around the display snapshot, held from the other side. The library knows which
 * episodes you ticked; it has no idea how many exist, and storing that would put a number
 * TMDB owns into your export where it could quietly go stale and change what "finished"
 * means without anything having happened.
 *
 * Seasons are listed only when their episode count is *confirmable* — see `censusFrom`.
 */
export interface SeasonCensus {
  season: number;
  episodes: number;
}

export function seriesProgress(library: Library, seriesId: number): SeriesProgress {
  return library.progress[String(seriesId)] ?? {};
}

export function watchedInSeason(
  library: Library,
  seriesId: number,
  season: number,
): number[] {
  return seriesProgress(library, seriesId)[String(season)] ?? [];
}

/** Episodes ticked across a series, excluding specials, which are counted separately. */
export function watchedCount(library: Library, seriesId: number): number {
  const progress = seriesProgress(library, seriesId);
  return Object.entries(progress)
    .filter(([season]) => Number(season) !== SPECIALS_SEASON)
    .reduce((total, [, episodes]) => total + episodes.length, 0);
}

/**
 * Replace one season's watched set.
 *
 * Empty seasons and empty series are deleted rather than kept as `[]`, for the reason
 * `update` deletes empty entries: a record that says you did nothing is not a fact about
 * you, and an export full of them is a list of pages you happened to open.
 */
function writeSeason(seriesId: number, season: number, episodes: number[]) {
  const key = String(seriesId);
  const seasonKey = String(season);
  const progress = { ...getSnapshot().progress };
  const seasons = { ...(progress[key] ?? {}) };

  if (episodes.length === 0) {
    delete seasons[seasonKey];
  } else {
    seasons[seasonKey] = [...new Set(episodes)].sort((a, b) => a - b);
  }

  if (Object.keys(seasons).length === 0) {
    delete progress[key];
  } else {
    progress[key] = seasons;
  }

  write(getSnapshot().entries, progress);
}

export function setEpisodeWatched(
  seriesId: number,
  season: number,
  episode: number,
  watched: boolean,
) {
  const current = watchedInSeason(getSnapshot(), seriesId, season);
  writeSeason(
    seriesId,
    season,
    watched ? [...current, episode] : current.filter((e) => e !== episode),
  );
}

export function setSeasonWatched(seriesId: number, season: number, episodes: number[]) {
  writeSeason(seriesId, season, episodes);
}

/**
 * Mark everything up to and including one episode — every earlier season in full, then this
 * season up to the chosen number.
 *
 * This is the affordance that separates a tracker from a demo: nobody starts recording at
 * S1E1, they start at whatever they are watching tonight, and the alternative is forty
 * checkboxes. It walks the census rather than the stored progress so that "everything
 * before this" means everything that exists, not everything already ticked.
 *
 * **Later seasons are left alone.** Someone marking S4E2 is saying where they are, not
 * unsaying a season five they may have watched out of order.
 */
export function markThrough(
  seriesId: number,
  season: number,
  episode: number,
  census: SeasonCensus[],
) {
  const key = String(seriesId);
  const progress = { ...getSnapshot().progress };
  const seasons = { ...(progress[key] ?? {}) };

  for (const entry of census) {
    if (entry.season === SPECIALS_SEASON || entry.season > season) continue;

    const upTo = entry.season === season ? episode : entry.episodes;
    const existing = seasons[String(entry.season)] ?? [];
    const filled = new Set(existing);
    for (let e = 1; e <= upTo; e++) filled.add(e);

    if (filled.size > 0) seasons[String(entry.season)] = [...filled].sort((a, b) => a - b);
  }

  if (Object.keys(seasons).length > 0) progress[key] = seasons;
  write(getSnapshot().entries, progress);
}

/** Every confirmable episode of every season, specials excluded. Used by the Finished control. */
export function fillSeries(seriesId: number, census: SeasonCensus[]) {
  const key = String(seriesId);
  const progress = { ...getSnapshot().progress };
  const seasons = { ...(progress[key] ?? {}) };

  for (const entry of census) {
    if (entry.season === SPECIALS_SEASON || entry.episodes === 0) continue;
    const filled = new Set(seasons[String(entry.season)] ?? []);
    for (let e = 1; e <= entry.episodes; e++) filled.add(e);
    seasons[String(entry.season)] = [...filled].sort((a, b) => a - b);
  }

  if (Object.keys(seasons).length > 0) progress[key] = seasons;
  write(getSnapshot().entries, progress);
}

/** Forget every episode of a series, leaving specials and the title-level status alone. */
export function clearSeries(seriesId: number) {
  const key = String(seriesId);
  const progress = { ...getSnapshot().progress };
  const specials = progress[key]?.[String(SPECIALS_SEASON)];

  if (specials) progress[key] = { [String(SPECIALS_SEASON)]: specials };
  else delete progress[key];

  write(getSnapshot().entries, progress);
}

/* -------------------------------------------------------------------------- */
/* The roll-up                                                                 */
/* -------------------------------------------------------------------------- */

/** Ranked, so the effective status can be the higher of the two claims rather than a branch. */
const RANK: Record<WatchStatus, number> = { want: 0, watching: 1, watched: 2 };

/**
 * The status implied by the episodes you have ticked, or `null` when you have ticked none.
 *
 * **A still-running or unaired series is capped at "watching" and can never derive
 * "watched".** That is decisions.md #15's argument applied to progress: finishing is a claim
 * about a story that ended, and a series with more coming has not ended however much of it
 * you have seen. The cap is written explicitly rather than left to fall out of the
 * arithmetic — a season TMDB has not published yet is simply absent from the census, so a
 * viewer caught up on a running show would otherwise satisfy "every season complete" and be
 * told they had finished something still in production.
 *
 * Specials are excluded on both sides. Breaking Bad has nine of them; counting them would
 * mean nobody ever finishes it.
 */
export function derivedStatus(
  progress: SeriesProgress,
  census: SeasonCensus[],
  running: boolean,
): WatchStatus | null {
  const countable = census.filter((s) => s.season !== SPECIALS_SEASON && s.episodes > 0);

  const watched = Object.entries(progress)
    .filter(([season]) => Number(season) !== SPECIALS_SEASON)
    .reduce((total, [, episodes]) => total + episodes.length, 0);

  if (watched === 0) return null;
  if (running) return "watching";
  if (countable.length === 0) return "watching";

  const complete = countable.every((entry) => {
    const ticked = progress[String(entry.season)] ?? [];
    return ticked.filter((e) => e >= 1 && e <= entry.episodes).length >= entry.episodes;
  });

  return complete ? "watched" : "watching";
}

/**
 * What the app should say about a series: the higher of what you claimed and what your
 * episodes imply.
 *
 * Taking the maximum is what makes the roll-up **promote-only without storing a second
 * field**. A status you set by hand is never lowered by episode activity, because it is
 * still one of the two candidates; a status you never set follows the grid freely in both
 * directions, because the other candidate is `null`. Un-ticking an episode therefore drops
 * you back to whatever you actually claimed, rather than stranding you on a "Finished" that
 * the grid no longer supports.
 */
export function effectiveStatus(
  claimed: WatchStatus | null | undefined,
  derived: WatchStatus | null,
): WatchStatus | null {
  if (!claimed) return derived;
  if (!derived) return claimed;
  return RANK[derived] > RANK[claimed] ? derived : claimed;
}
