"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BookmarkSimple } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { PlayCircle } from "@phosphor-icons/react/dist/csr/PlayCircle";
import type { Icon } from "@phosphor-icons/react";
import {
  type TitleRef,
  type WatchStatus,
  STATUSES,
  getEntry,
  getServerSnapshot,
  getSnapshot,
  refreshRef,
  setStatus,
  statusLabel,
  subscribe,
  toggleFavourite,
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
export function LibraryControls(props: TitleRef) {
  const { kind, id, title, year, posterPath } = props;

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

  const entry = getEntry(library, kind, id);

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
        {STATUSES[kind].map((status) => {
          const IconFor = ICONS[status];
          const active = known && entry?.status === status;

          return (
            <button
              key={status}
              type="button"
              disabled={!known}
              // Undefined rather than `false` until the state is known. A disabled control
              // reporting `aria-pressed="false"` tells a screen reader the same untruth the
              // greyed-out styling exists to avoid telling everyone else.
              aria-pressed={known ? active : undefined}
              // Clicking the state you are already in clears it, so there is no separate
              // "remove" affordance to design or explain.
              onClick={() => setStatus(props, active ? null : status)}
              className={`label flex cursor-pointer items-center gap-2 transition-colors disabled:cursor-default ${
                active ? "text-ink" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              <IconFor size={17} weight={active ? "fill" : "regular"} aria-hidden />
              {statusLabel(status, kind)}
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
        onClick={() => toggleFavourite(props)}
        className={`label flex cursor-pointer items-center gap-2 transition-colors disabled:cursor-default ${
          known && entry?.favourite
            ? "text-ink"
            : "text-ink-faint hover:text-ink-muted"
        }`}
      >
        <Heart
          size={17}
          weight={known && entry?.favourite ? "fill" : "regular"}
          aria-hidden
        />
        Favourite
      </button>
    </div>
  );
}

function alwaysTrue() {
  return true;
}

function alwaysFalse() {
  return false;
}
