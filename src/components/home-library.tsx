"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { posterUrl, profileUrl } from "@/lib/images";
import {
  type LibraryEntry,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/library";
import { type LibraryDigest, EMPTY_DIGEST } from "@/lib/digest";
import {
  type FranchiseRow,
  type SeriesRow,
  cancelledUnstarted,
  caughtUp,
  continueWatching,
  partwayFranchises,
} from "@/lib/home";
import type { Face } from "@/lib/faces";
import { EXAMPLE_SIZE, isExample, loadExample, removeExample } from "@/lib/example";
import { franchiseHref, personHref, seriesHref } from "@/lib/types";
import { Plate } from "./plate";

/**
 * The home page's library half.
 *
 * **The sorting rule this page was built to: a section made from your data is in, a section
 * made from the world's is out.** Trending, popular, top rated, now playing, box office,
 * certified fresh — refused, not deferred. They are what #1 ruled out on day one, and they
 * are what makes every tracker in this category the same tracker. What is left is the set of
 * things only this app can say, because only this app is holding both halves.
 *
 * The join costs a round trip: the library is `localStorage` and TMDB is server-only, so
 * nothing here can be rendered until the browser has asked (`/api/digest`). Faces asks
 * separately, because it is slower than everything else put together and folding it in would
 * make the whole page wait for it.
 */
export function HomeLibrary() {
  const library = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const known = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  /*
   * Failure is a value the request can return, not a second flag beside it.
   *
   * A separate `failed` boolean has to be reset when a new request starts, which means
   * writing state from inside the effect body — and that is the cascading render React now
   * warns about. One slot with three readings (nothing yet, an answer, a failure) has no
   * reset to perform: whatever the request resolves to replaces what was there.
   */
  const [fetchedDigest, setFetchedDigest] = useState<LibraryDigest | "failed" | null>(null);
  const [fetchedFaces, setFetchedFaces] = useState<Face[] | null>(null);

  /*
   * A string, not the arrays it describes, and that is the whole point of it.
   *
   * The library is a fresh object on every write, so an effect keyed on it would re-fetch
   * the digest every time a checkbox moved. What the digest actually depends on is *which
   * titles* are in the library — never their statuses, and never your episode ticks, since
   * how many episodes a season has is not a fact about you. Keying on this signature means
   * the request fires when a title is added or removed, and at no other time.
   */
  const signature = useMemo(() => signatureOf(library.entries, false), [library.entries]);
  const favouriteSignature = useMemo(
    () => signatureOf(library.entries, true),
    [library.entries],
  );

  /*
   * The two cases with nothing to ask are answered during render rather than by an effect
   * that immediately sets state.
   *
   * "There is nothing to fetch" is not news arriving from outside — it is a fact about the
   * library that is already in hand, and storing it would mean rendering one frame of
   * "loading" for a request that is never going to be made.
   */
  const request = useMemo(() => parseSignature(signature), [signature]);
  const favourites = useMemo(
    () => parseSignature(favouriteSignature),
    [favouriteSignature],
  );

  const nothingToAsk = request.films.length + request.series.length === 0;
  // One favourite cannot have anything in common with anything.
  const tooFewFavourites = favourites.films.length + favourites.series.length < 2;

  const digest = nothingToAsk ? EMPTY_DIGEST : fetchedDigest;
  const faces = tooFewFavourites ? NO_FACES : fetchedFaces;

  useEffect(() => {
    const body = parseSignature(signature);
    if (body.films.length + body.series.length === 0) return;

    let live = true;
    post<LibraryDigest>("/api/digest", body)
      .then((data) => live && setFetchedDigest(data))
      .catch(() => live && setFetchedDigest("failed"));

    return () => {
      live = false;
    };
  }, [signature]);

  useEffect(() => {
    const body = parseSignature(favouriteSignature);
    if (body.films.length + body.series.length < 2) return;

    let live = true;
    post<{ faces: Face[] }>("/api/faces", body)
      .then((data) => live && setFetchedFaces(data.faces))
      .catch(() => live && setFetchedFaces(NO_FACES));

    return () => {
      live = false;
    };
  }, [favouriteSignature]);

  // The server has no idea what is in your browser, so it renders the premise and nothing
  // else — the same refusal to assert an unknown that #31 makes about the controls.
  if (!known) return <Premise />;

  const empty = Object.keys(library.entries).length === 0;
  if (empty) return <EmptyLibrary />;

  if (digest === "failed") {
    return (
      <p
        role="alert"
        className="text-body text-accent border-accent/30 mt-10 border-l-2 pl-4"
      >
        Your library is here, but TMDB could not be reached to work out what to say about
        it. Reload to try again.
      </p>
    );
  }

  if (!digest) return <Waiting />;

  const watching = continueWatching(library, digest);
  const level = caughtUp(library, digest);
  const franchises = partwayFranchises(library, digest);
  const cancelled = cancelledUnstarted(library, digest);
  const nothing =
    watching.length === 0 &&
    level.length === 0 &&
    franchises.length === 0 &&
    cancelled.length === 0 &&
    (faces?.length ?? 0) === 0;

  return (
    <div className="pt-10">
      {isExample() ? <ExampleNotice /> : null}

      {/*
        Continue watching leads.
        Faces is the app's best argument and it closes the page instead of opening it, for
        two reasons: it arrives last, so anything under it would be shoved down the page as
        it landed; and someone opening a tracker is trying to resume something, not to be
        told what their taste looks like.
      */}
      <SeriesSection
        title="Continue watching"
        rows={watching}
        note="Where you are, counted against what has actually aired."
      />

      <SeriesSection
        title="Waiting for more"
        rows={level}
        note="You have seen everything that has gone out. These are coming back."
      />

      <FranchiseSection rows={franchises} />

      <SeriesSection
        title="Cancelled before you start"
        rows={cancelled}
        note="Cut off rather than finished — worth knowing before you begin."
        line={extentLine}
      />

      <FacesSection faces={faces} entries={library.entries} />

      <Unresolved keys={digest.unresolved} entries={library.entries} />

      {nothing ? (
        <Contents lead="Nothing to show yet. With a few things marked, it reads like this:" />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Series sections                                                             */
/* -------------------------------------------------------------------------- */

function SeriesSection({
  title,
  rows,
  note,
  line = progressLine,
}: {
  title: string;
  rows: SeriesRow[];
  note: string;
  /**
   * What a row says about itself, which is not the same question in every section.
   *
   * It was one shared progress line until the page was looked at: under *Cancelled before
   * you start*, "next up S1 E1" is both useless and a contradiction of the heading above
   * it. A section that exists to help you decide whether to begin something should be
   * telling you how much of it there is, not offering to start it.
   */
  line?: (row: SeriesRow) => string;
}) {
  // A section with nothing in it is omitted rather than shown empty. The empty library gets
  // the full contents page once; a library that simply has no cancelled series in it does
  // not need to be told so every time it loads.
  if (rows.length === 0) return null;

  return (
    <Section title={title} note={note}>
      {rows.map((row) => (
        <TitleRow
          key={row.entry.id}
          entry={row.entry}
          href={seriesHref(row.entry.id, row.entry.title)}
          meta={line(row)}
        />
      ))}
    </Section>
  );
}

/** How much of it there is — what you weigh when deciding whether to start something. */
function extentLine(row: SeriesRow): string {
  if (row.aired === 0) return "Nothing aired";

  const seasons = row.seasons === 1 ? "one season" : `${row.seasons} seasons`;
  const episodes = row.aired === 1 ? "one episode" : `${row.aired} episodes`;

  return `Cut off after ${seasons} · ${episodes}`;
}

/**
 * What a series row says about your position in it.
 *
 * Named where the app can name it, counted where it cannot. A series that numbers its
 * episodes straight through withholds its episode numbers rather than inventing them (#43),
 * so "next up" is unavailable on exactly those shows — and the count, which is still exact,
 * is what the row falls back to rather than falling silent.
 */
function progressLine(row: SeriesRow): string {
  if (row.aired === 0) return "Nothing has aired yet";

  const left = row.aired - row.watched;
  const counted = `${row.watched} of ${row.aired} episodes`;

  if (left === 0) return counted;
  if (!row.nextUp) return `${counted} · ${left} to go`;

  return `${counted} · next up S${row.nextUp.season} E${row.nextUp.episode}`;
}

/* -------------------------------------------------------------------------- */
/* Franchises                                                                  */
/* -------------------------------------------------------------------------- */

function FranchiseSection({ rows }: { rows: FranchiseRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Section
      title="Partway through a franchise"
      note="Runs you have started and not finished, counted against what has been released."
    >
      {rows.map((row) => (
        <li key={row.franchise.id} className="border-rule border-t">
          <Link
            href={franchiseHref(row.franchise.id, row.franchise.name)}
            className="hover:bg-paper-sunk/60 -mx-3 flex gap-5 px-3 py-6 transition-colors"
          >
            <Plate
              src={posterUrl(row.next?.posterPath ?? null)}
              alt={row.next?.title ?? ""}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="editorial text-title text-ink text-balance">
                  {franchiseLabel(row.franchise.name)}
                </h3>
                <span className="label text-ink-faint shrink-0 tabular-nums">
                  {row.seen} of {row.released}
                </span>
              </div>

              {row.next ? (
                <p className="text-meta text-ink-muted mt-2">
                  Next: <span className="text-ink">{row.next.title}</span>
                  {row.next.year ? ` (${row.next.year})` : ""}
                </p>
              ) : null}

              {/*
                Announced entries are named rather than folded into the denominator. Counting
                them would make the run permanently unfinishable — two Avatar sequels that do
                not exist yet would hold you at "3 of 5" forever, which is the same false
                statement #17 refuses when it declines to render an announcement like a film.
              */}
              {row.announced > 0 ? (
                <p className="text-meta text-ink-faint mt-1">
                  {row.announced === 1
                    ? "One more announced, not yet released"
                    : `${row.announced} more announced, not yet released`}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </Section>
  );
}

/** TMDB files almost every collection as "<Name> Collection" — its word, not the run's (#20). */
function franchiseLabel(name: string): string {
  return name.replace(/\s+Collection$/i, "").trim() || name;
}

/* -------------------------------------------------------------------------- */
/* Faces                                                                       */
/* -------------------------------------------------------------------------- */

function FacesSection({
  faces,
  entries,
}: {
  faces: Face[] | null;
  entries: Record<string, LibraryEntry>;
}) {
  /*
   * The waiting state #30 committed to when it decided cast lists are fetched on demand and
   * never cached into the library. That decision made this section impossible to
   * server-render — the server cannot know your favourites while it renders — and it said at
   * the time that the cost was a designed wait rather than a defect. This is it.
   */
  if (faces === null) {
    return (
      <Section title="Faces you keep watching" note="">
        <li className="text-meta text-ink-faint border-rule border-t py-6 italic">
          Reading the cast of every film and series you have marked a favourite…
        </li>
      </Section>
    );
  }

  if (faces.length === 0) return null;

  return (
    <Section
      title="Faces you keep watching"
      note="People who appear in more than one of your favourites."
    >
      {faces.map((face) => {
        /*
         * Oldest first, resolved against the library rather than sent down with the faces.
         *
         * The server hands these back in whatever order it fanned out, which is stable but
         * arbitrary — and a list of three films someone was in reads as a career when it
         * runs in order and as a set when it does not.
         */
        const appearances = face.titles
          .map((title) => entries[`${title.kind}:${title.id}`])
          .filter((entry): entry is LibraryEntry => Boolean(entry))
          .sort((a, b) => (a.year ?? "").localeCompare(b.year ?? ""))
          .map((entry) => entry.title);

        return (
          <li key={face.id} className="border-rule border-t">
            <Link
              href={personHref(face.id, face.name)}
              className="hover:bg-paper-sunk/60 -mx-3 flex items-center gap-4 px-3 py-4 transition-colors"
            >
              <Plate src={profileUrl(face.profilePath)} size="mini" align="center" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="editorial text-subtitle text-ink">{face.name}</h3>
                  <span className="label text-ink-faint shrink-0 tabular-nums">
                    {face.titles.length}
                  </span>
                </div>
                <p className="text-meta text-ink-muted mt-0.5">{appearances.join(" · ")}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Titles the world no longer has                                              */
/* -------------------------------------------------------------------------- */

/**
 * Titles in your library that TMDB could not resolve — deleted, merged, or simply a request
 * that failed.
 *
 * Named rather than quietly missing, on the obligation this app keeps landing on: #23
 * reports the credits it withholds, #37 reports a storage write that failed, #43 explains an
 * empty episode grid. **A section that renders fewer rows than your library holds is
 * indistinguishable from a broken one**, and the library is the one thing here that cannot
 * be re-fetched from anywhere.
 */
function Unresolved({
  keys,
  entries,
}: {
  keys: string[];
  entries: Record<string, LibraryEntry>;
}) {
  if (keys.length === 0) return null;

  // The digest keys franchises as well as titles, and a franchise that would not load is a
  // section that comes up short — not a title missing from your own list.
  const titles = keys
    .map((key) => entries[key]?.title)
    .filter((title): title is string => Boolean(title));

  if (titles.length === 0) return null;

  return (
    <p className="text-meta text-ink-faint border-rule mt-12 border-t pt-4 italic">
      {titles.length === 1
        ? `${titles[0]} is in your library, but TMDB has nothing under that id any more — so it is missing from the sections above.`
        : `${titles.length} titles in your library could not be found on TMDB and are missing from the sections above: ${titles.join(", ")}.`}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared furniture                                                            */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="label text-ink-faint">{title}</h2>
      {note ? <p className="text-meta text-ink-muted mt-1.5 max-w-md">{note}</p> : null}
      <ul className="mt-4">{children}</ul>
    </section>
  );
}

function TitleRow({
  entry,
  href,
  meta,
}: {
  entry: LibraryEntry;
  href: string;
  meta: string;
}) {
  return (
    <li className="border-rule border-t">
      <Link
        href={href}
        className="hover:bg-paper-sunk/60 -mx-3 flex gap-5 px-3 py-6 transition-colors"
      >
        <Plate src={posterUrl(entry.posterPath)} alt={entry.title} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="editorial text-title text-ink text-balance">{entry.title}</h3>
            {entry.year ? (
              <span className="label text-ink-faint shrink-0 tabular-nums">
                {entry.year}
              </span>
            ) : null}
          </div>
          <p className="text-meta text-ink-muted mt-2">{meta}</p>
        </div>
      </Link>
    </li>
  );
}

function Premise() {
  return (
    <p className="text-body text-ink-muted max-w-md pt-10 italic">
      Every film in a franchise in one place. The faces that recur across what you love.
      Whether a series is still running before you start it.
    </p>
  );
}

function Waiting() {
  return (
    <p className="text-meta text-ink-faint pt-10 italic">
      Working out where you are with everything…
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* The empty library                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Each note is a worked sentence rather than a description of a category.
 *
 * The first version described — *"series you are in the middle of, and which episode is
 * next"* — and read as a table of contents for a page that was not there. Only the franchise
 * note was concrete, and it was the only one that landed, because **naming two of the four
 * Alien films shows the shape of a row where a category name only asserts that rows exist.**
 *
 * Rejected on the way here: wireframe placeholder cards in the shape of the eventual rows.
 * They show the shape directly, and they borrow the one visual convention this page has
 * already spent — the digest and the faces request both arrive late, so a skeleton here would
 * be a permanent fake of a loading state that genuinely happens twenty pixels away.
 *
 * The titles are the example library's, deliberately: press the button underneath and these
 * sentences become the rows.
 *
 * **They are plain declaratives rather than completions of the lead.** The first version read
 * *"That you are eleven episodes into Breaking Bad"*, each note finishing a sentence the lead
 * had started — grammatical, and mannered enough that it was the construction you noticed
 * instead of the content. The lead now frames them as a specimen (*"reads like this"*), which
 * costs one word and lets every note stand up on its own.
 */
const SECTIONS: { title: string; note: string }[] = [
  {
    title: "Continue watching",
    note: "You are eleven episodes into Breaking Bad, and the next one is S2 E5.",
  },
  {
    title: "Waiting for more",
    note: "You are level with Severance, and there is more of it coming.",
  },
  {
    title: "Partway through a franchise",
    note: "You have seen two of the four Alien films, and Alien³ is next.",
  },
  {
    title: "Cancelled before you start",
    note: "Mindhunter was cut off after two seasons rather than finished.",
  },
  {
    title: "Faces you keep watching",
    note: "Bill Paxton is in three of your favourites.",
  },
];

/**
 * The empty state, which is a contents page.
 *
 * Every section on this page is computed from your own data, so a first visit has nothing to
 * render — and that is by choice, since the obvious filler is a trending row, which is the
 * one thing this page refuses to be. Listing the sections and what fills each of them says
 * more about the app than a grid of this week's releases would, and it is honest about the
 * fact that the app has not met you yet.
 */
function Contents({ lead }: { lead?: string }) {
  return (
    <section className={lead ? "mt-12" : "mt-10"}>
      <p className="text-meta text-ink-faint">
        {lead ?? "Once you have marked a few things, this page reads like this:"}
      </p>
      <ul className="mt-5">
        {SECTIONS.map((section) => (
          <li key={section.title} className="border-rule border-t py-4">
            <h2 className="label text-ink-muted">{section.title}</h2>
            <p className="text-meta text-ink-faint mt-1 max-w-md">{section.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyLibrary() {
  return (
    <>
      <Premise />
      <Contents />

      {/*
        The example writes into the real store rather than into a preview mode, so every
        section that appears afterwards was computed by the code that ships. It is offered
        only here, on a library with nothing in it — which is what makes removing it safe.
      */}
      <div className="border-rule mt-10 border-t pt-6">
        <button
          type="button"
          onClick={loadExample}
          className="label text-ink hover:text-accent cursor-pointer border-b-2 border-transparent pb-1 underline underline-offset-4 transition-colors"
        >
          Fill it with an example library
        </button>
        <p className="text-meta text-ink-faint mt-2 max-w-md">
          {EXAMPLE_SIZE.films} films and {EXAMPLE_SIZE.series} series, marked the way someone
          who had been using this a while would have marked them. It saves into this browser
          exactly as your own would, and you can take it out again.
        </p>
      </div>
    </>
  );
}

function ExampleNotice() {
  return (
    <div className="border-rule bg-paper-sunk/60 mb-10 border-y px-4 py-3">
      <p className="text-meta text-ink-muted">
        This is the example library.{" "}
        <button
          type="button"
          onClick={removeExample}
          className="hover:text-ink cursor-pointer underline underline-offset-2"
        >
          Remove it
        </button>{" "}
        — it takes out only what it put in.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Plumbing                                                                    */
/* -------------------------------------------------------------------------- */

function signatureOf(
  entries: Record<string, LibraryEntry>,
  favouritesOnly: boolean,
): string {
  const films: number[] = [];
  const series: number[] = [];

  for (const entry of Object.values(entries)) {
    if (favouritesOnly && !entry.favourite) continue;
    (entry.kind === "film" ? films : series).push(entry.id);
  }

  // Sorted so that two libraries holding the same titles produce the same string, whatever
  // order the keys happen to come back in.
  films.sort((a, b) => a - b);
  series.sort((a, b) => a - b);

  return `${films.join(",")}|${series.join(",")}`;
}

function parseSignature(signature: string): { films: number[]; series: number[] } {
  const [films = "", series = ""] = signature.split("|");
  const numbers = (part: string) =>
    part ? part.split(",").map(Number).filter(Number.isInteger) : [];

  return { films: numbers(films), series: numbers(series) };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return (await response.json()) as T;
}

/** One module-level identity, so "no faces" does not build a new array on every render. */
const NO_FACES: Face[] = [];

function alwaysTrue() {
  return true;
}

function alwaysFalse() {
  return false;
}
