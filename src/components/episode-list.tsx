"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Circle } from "@phosphor-icons/react/dist/csr/Circle";
import {
  type SeasonCensus,
  getServerSnapshot,
  getSnapshot,
  markThrough,
  setEpisodeWatched,
  setSeasonWatched,
  subscribe,
  watchedInSeason,
} from "@/lib/library";
import { type Episode, formatDate, formatRuntime, hasAired } from "@/lib/types";

interface EpisodeListProps {
  seriesId: number;
  season: number;
  episodes: Episode[];
  /** Confirmable seasons, so "everything before this" can reach back past this one. */
  census: SeasonCensus[];
}

/**
 * A season as a checklist.
 *
 * **Rejected: episode synopses on each row.** They are what a season page usually shows and
 * they are actively hostile here — this is the screen where you mark what you have seen, so
 * every row below your place would be a plot summary of something you have not watched yet.
 * Showing them only for watched episodes was the obvious repair and was also rejected: rows
 * that grow as you tick them make the list jump under the cursor you are ticking with.
 *
 * So the row carries what decides "was this the one" without spoiling it — number, title,
 * when it went out, how long it ran.
 */
export function EpisodeList({ seriesId, season, episodes, census }: EpisodeListProps) {
  const library = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const known = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  const watched = new Set(watchedInSeason(library, seriesId, season));

  // Only episodes that exist can be ticked, so they are also the only ones the season-level
  // actions may touch. Marking a season watched must not claim next month's finale.
  const aired = episodes.filter((episode) => hasAired(episode));
  const airedNumbers = aired.map((episode) => episode.episode_number);
  const airedWatched = airedNumbers.filter((n) => watched.has(n)).length;
  const allAiredWatched = aired.length > 0 && airedWatched === aired.length;

  return (
    <section className="mt-8">
      <div className="border-rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-3">
        <h2 className="label text-ink-faint">
          {known
            ? `${airedWatched} of ${aired.length} watched`
            : `${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"}`}
        </h2>

        {aired.length > 0 ? (
          <button
            type="button"
            disabled={!known}
            onClick={() =>
              setSeasonWatched(seriesId, season, allAiredWatched ? [] : airedNumbers)
            }
            className="label text-ink-faint hover:text-ink cursor-pointer transition-colors disabled:cursor-default"
          >
            {allAiredWatched ? "Clear season" : "Mark season watched"}
          </button>
        ) : null}
      </div>

      <ul>
        {episodes.map((episode) => {
          const number = episode.episode_number;
          const isWatched = known && watched.has(number);
          const airedYet = hasAired(episode);
          const meta = [formatDate(episode.air_date), formatRuntime(episode.runtime)]
            .filter(Boolean)
            .join(" · ");

          return (
            <li key={episode.id} className="border-rule group/row border-b">
              <div className="flex items-baseline gap-3 py-3">
                <button
                  type="button"
                  disabled={!known || !airedYet}
                  aria-pressed={known && airedYet ? isWatched : undefined}
                  aria-label={`${
                    isWatched ? "Mark unwatched" : "Mark watched"
                  }: episode ${number}, ${episode.name}`}
                  onClick={() => setEpisodeWatched(seriesId, season, number, !isWatched)}
                  className={`shrink-0 translate-y-0.5 cursor-pointer transition-colors disabled:cursor-default ${
                    isWatched ? "text-ink" : "text-ink-faint hover:text-ink-muted"
                  } ${!airedYet ? "opacity-40" : ""}`}
                >
                  {isWatched ? (
                    <CheckCircle size={19} weight="fill" aria-hidden />
                  ) : (
                    <Circle size={19} aria-hidden />
                  )}
                </button>

                <span className="text-meta text-ink-faint w-6 shrink-0 tabular-nums">
                  {number}
                </span>

                {/* Nothing truncates here either — #21, and an episode title is the thing
                    you are scanning for. */}
                <span className="min-w-0 flex-1">
                  <span className={`text-body ${airedYet ? "text-ink" : "text-ink-muted"}`}>
                    {episode.name}
                  </span>

                  {airedYet ? (
                    <button
                      type="button"
                      disabled={!known}
                      onClick={() => markThrough(seriesId, season, number, census)}
                      /*
                       * Revealed on hover on a pointer device, and permanently visible where
                       * there is no hover to reveal it with. A touch user has no way to
                       * discover a control that only exists during a state their device
                       * cannot enter — which would have made the one affordance that turns
                       * this from a demo into a tracker reachable on desktop only.
                       */
                      className="label text-ink-faint hover:text-ink ml-3 cursor-pointer opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 disabled:cursor-default [@media(hover:none)]:opacity-100"
                    >
                      and everything before
                    </button>
                  ) : null}
                </span>

                <span className="text-meta text-ink-faint shrink-0 text-right">
                  {airedYet ? meta : meta || "Date to be confirmed"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/*
        Said rather than left to be inferred from a greyed-out control, on the same
        obligation as #23's withheld-credit count and #37's blocked-storage line: a disabled
        thing with no reason attached is indistinguishable from a broken one.
      */}
      {aired.length < episodes.length ? (
        <p className="text-meta text-ink-muted mt-4 italic">
          {episodes.length - aired.length} of these{" "}
          {episodes.length - aired.length === 1 ? "has" : "have"} not aired yet, so{" "}
          {episodes.length - aired.length === 1 ? "it cannot" : "they cannot"} be marked
          watched.
        </p>
      ) : null}
    </section>
  );
}

function alwaysTrue() {
  return true;
}

function alwaysFalse() {
  return false;
}
