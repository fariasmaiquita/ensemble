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

export interface Library {
  version: 1;
  entries: Record<string, LibraryEntry>;
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
const EMPTY: Library = Object.freeze({ version: VERSION, entries: {} }) as Library;

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

  return { version: VERSION, entries };
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

function write(entries: Record<string, LibraryEntry>) {
  const next: Library = { version: VERSION, entries };
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
