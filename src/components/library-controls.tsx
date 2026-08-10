"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BookmarkSimple } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { PlayCircle } from "@phosphor-icons/react/dist/csr/PlayCircle";
import type { Icon } from "@phosphor-icons/react";
import {
  type SeasonCensus,
  type TitleRef,
  type WatchStatus,
  STATUSES,
  clearSeries,
  derivedStatus,
  effectiveStatus,
  fillSeries,
  getEntry,
  getServerSnapshot,
  getSnapshot,
  getStorageBlocked,
  getStorageBlockedServer,
  refreshRef,
  seriesProgress,
  setStatus,
  statusLabel,
  subscribe,
  toggleFavourite,
  watchedCount,
} from "@/lib/library";

const ICONS: Record<WatchStatus, Icon> = {
  want: BookmarkSimple,
  watching: PlayCircle,
  watched: CheckCircle,
};

/**
 * The band under a detail page's title, holding the two things the app records about you:
 * where you are with it, and whether it is one of the ones that matter.
 *
 * Controls live on detail pages only. Hanging them off search rows was considered and
 * refused: decisions.md #13 makes a result row a catalogue entry you read and click, and a
 * row with buttons in it is a storefront listing.
 */
interface LibraryControlsProps extends TitleRef {
  /**
   * Series only: the seasons whose episode counts are confirmable, from `airedSeasons`.
   * Passed in rather than read from storage — the library holds your ticks and has no idea
   * how many episodes exist (decisions.md #32, and `SeasonCensus`).
   */
  census?: SeasonCensus[];
  /** Series only: whether the series may still gain episodes, which caps the roll-up. */
  openEnded?: boolean;
}

export function LibraryControls(props: LibraryControlsProps) {
  const { kind, id, title, year, posterPath, census, openEnded } = props;
  const ref: TitleRef = { kind, id, title, year, posterPath };

  const library = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /*
   * Whether the browser has taken over from the server-rendered HTML.
   *
   * This is not ceremony. The server cannot know what is in your `localStorage`, so the
   * first paint has no answer — and rendering the *unset* state in the meantime would have
   * the page assert "you have not watched this" about a film you finished last week. It is
   * brief and it is still a false statement, which is the thing this app keeps refusing to
   * make (#17, #23). So the band renders inert and unclaimed until it knows.
   *
   * Same primitive as the store above rather than an effect: server snapshot `false`,
   * client snapshot `true`, resolved in the same pass as the data.
   */
  const known = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);
  const blocked = useSyncExternalStore(
    subscribe,
    getStorageBlocked,
    getStorageBlockedServer,
  );

  const entry = getEntry(library, kind, id);

  /*
   * Two claims about the same series, and the app shows the higher of them.
   *
   * `entry.status` is what you said; `derived` is what your ticked episodes imply. Taking the
   * maximum is what makes the roll-up promote-only without a second stored field — see
   * `effectiveStatus`. A film has no episodes and no census, so both are inert here.
   */
  const progress = kind === "series" ? seriesProgress(library, id) : {};
  const derived =
    kind === "series" ? derivedStatus(progress, census ?? [], openEnded ?? false) : null;
  const status = effectiveStatus(entry?.status, derived);
  const episodes = kind === "series" ? watchedCount(library, id) : 0;

  /*
   * The one state where clearing a status cannot clear it: you have ticked every episode, so
   * the grid goes on implying Finished after the claim is gone. Rather than let the control
   * look broken — or delete the ticks, which would assert you had watched none of it — the
   * band says which fact is holding it and offers the only action that changes it.
   */
  const heldByEpisodes = known && derived !== null && entry?.status == null;

  /*
   * The one case where marking a series finished cannot fill its episodes.
   *
   * A handful of series — long-running anime mostly — number their episodes straight
   * through instead of restarting each season, and the series response carries counts but
   * never numbers. Rather than write 197 identifiers that a season does not contain, the
   * census omits them and the fill skips those seasons (decisions.md #43).
   *
   * That silently leaves the band saying Finished above a season list reading zero, which is
   * exactly the disagreement #42 exists to prevent. It cannot be prevented here, so it is
   * disclosed here instead — the same obligation as #37 and #23. Saying nothing would leave
   * the reader to conclude the app had simply failed to save.
   */
  const unfillable =
    known &&
    kind === "series" &&
    entry?.status === "watched" &&
    (census?.some((entry) => !entry.numbers) ?? false);

  function onStatusClick(next: WatchStatus) {
    const claimed = entry?.status;

    if (claimed === next) {
      // Clicking the state you are already in clears it. The grid is deliberately untouched:
      // "I have not finished this" is not the same statement as "I have seen none of it".
      setStatus(ref, null);
      return;
    }

    setStatus(ref, next);

    // Finishing a series fills the grid, so the band and the season list can never disagree
    // about a series you said you finished. It fills only what `airedSeasons` vouches for,
    // so a season still going to air is left empty rather than invented.
    if (next === "watched" && kind === "series" && census && census.length > 0) {
      fillSeries(ref, census);
    }
  }

  // The one moment the app holds both the stored copy of a title and TMDB's current answer.
  // Writes only when they actually differ — see `refreshRef`.
  // Depends on the fields rather than the object: `props` is a fresh identity every render,
  // so an effect keyed on it would run on every render instead of on a real change.
  useEffect(() => {
    refreshRef({ kind, id, title, year, posterPath });
  }, [kind, id, title, year, posterPath]);

  return (
    /*
     * One control per line on narrow screens, a single band from `sm:` up.
     *
     * Measured rather than assumed: at a real 371px viewport with the `sm:` branch
     * confirmed inactive, the four series controls need 402px of words and wrapped to three
     * ragged rows, orphaning "Finished" and "Favourite" on lines of their own. Nothing
     * overflowed — it simply looked like a mistake.
     *
     * Rejected: dropping the labels and showing icons alone, which is what fits and what
     * most apps do. A bookmark, a play mark and a tick with no words are a guess, and this
     * is the app that keeps character names on a cast list (#16) because the words are the
     * content. A deliberate column costs about 20px more than the ragged wrap and reads as
     * a checklist in a programme rather than as a layout that ran out of room.
     */
    <div className="border-rule mt-8 flex flex-col items-start gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
      <div
        className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6"
        aria-busy={!known}
      >
        {STATUSES[kind].map((option) => {
          const IconFor = ICONS[option];
          const active = known && status === option;

          return (
            <button
              key={option}
              type="button"
              disabled={!known}
              // Undefined rather than `false` until the state is known. A disabled control
              // reporting `aria-pressed="false"` tells a screen reader the same untruth the
              // greyed-out styling exists to avoid telling everyone else.
              aria-pressed={known ? active : undefined}
              onClick={() => onStatusClick(option)}
              className={`label flex cursor-pointer items-center gap-2 border-b-2 pb-1 transition-colors disabled:cursor-default ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-faint hover:text-ink-muted"
              }`}
            >
              <IconFor size={17} weight={active ? "fill" : "regular"} aria-hidden />
              {statusLabel(option, kind)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!known}
        aria-pressed={known ? entry?.favourite === true : undefined}
        aria-label={
          !known
            ? "Favourite"
            : entry?.favourite
              ? "Remove from favourites"
              : "Add to favourites"
        }
        // `ref`, not `props`: the entry is built by spreading whatever it is handed, and the
        // census has no business being written into the user's stored library.
        onClick={() => toggleFavourite(ref)}
        className={`label flex cursor-pointer items-center gap-2 border-b-2 pb-1 transition-colors disabled:cursor-default ${
          known && entry?.favourite
            ? "border-ink text-ink"
            : "border-transparent text-ink-faint hover:text-ink-muted"
        }`}
      >
        <Heart
          size={17}
          weight={known && entry?.favourite ? "fill" : "regular"}
          aria-hidden
        />
        Favourite
      </button>

      {/*
        The one case where a filled mark is not the truth.

        Writing is synchronous, so a control that has filled in has already saved — which is
        why there is no "saving…" state here and no confirmation after the fact. The failure
        is the part that needed saying: when the browser refuses to persist, the click still
        registers, the icon still fills, and nothing is written. Silently, and identically to
        success. Saying so is the same obligation as #23's withheld-credit count.
      */}
      {heldByEpisodes ? (
        <p className="text-meta text-ink-muted basis-full">
          {statusLabel(status as WatchStatus, kind)} because{" "}
          {episodes === 1 ? "one episode is" : `${episodes} episodes are`} marked watched.{" "}
          <button
            type="button"
            onClick={() => clearSeries(id)}
            className="cursor-pointer underline underline-offset-2 hover:text-ink"
          >
            Clear episodes
          </button>
          .
        </p>
      ) : null}

      {unfillable ? (
        <p className="text-meta text-ink-muted basis-full">
          Marked finished, but the episodes are not ticked — this series numbers its episodes
          straight through rather than restarting each season, and the app will not guess
          which ones those are. Open a season to mark them there.
        </p>
      ) : null}

      {blocked ? (
        <p className="text-meta text-ink-muted basis-full italic">
          Not saved — this browser is blocking storage, so nothing here will be remembered
          after you leave.
        </p>
      ) : null}
    </div>
  );
}

function alwaysTrue() {
  return true;
}

function alwaysFalse() {
  return false;
}
