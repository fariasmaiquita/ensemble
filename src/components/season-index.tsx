"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  watchedInSeason,
} from "@/lib/library";
import { type Season, seasonHref, today, year } from "@/lib/types";

interface SeasonIndexProps {
  seriesId: number;
  seriesName: string;
  seasons: Season[];
  /** Season numbers the app will vouch for as fully aired — see `airedSeasons`. */
  confirmable: number[];
}

/**
 * The way into the episode lists, and the only place the series page says anything about
 * how far through you are.
 *
 * Built from `seasons`, which already rides on the series detail response, so listing every
 * season costs nothing. The counts are the reason this is a client component: they are the
 * user's data, and the server has no business guessing at them (#31).
 */
export function SeasonIndex({
  seriesId,
  seriesName,
  seasons,
  confirmable,
}: SeasonIndexProps) {
  const library = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const known = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);

  if (seasons.length === 0) return null;

  const ordered = [...seasons].sort((a, b) => a.season_number - b.season_number);

  return (
    <section className="border-rule mt-10 border-t pt-8">
      <h2 className="label text-ink-faint">Seasons</h2>

      <ul className="mt-4">
        {ordered.map((season) => {
          const watched = known
            ? watchedInSeason(library, seriesId, season.season_number).length
            : 0;

          /*
           * A season still going to air shows what you have watched but no denominator.
           * `episode_count` counts announced episodes, not broadcast ones, so "3 of 8" on a
           * season two episodes into its run states something false about six of them —
           * which is the same objection #17 raises to rendering an announcement like a film.
           */
          const vouched = confirmable.includes(season.season_number);
          const first = year(season.air_date);

          return (
            <li key={season.id} className="border-rule border-t">
              <Link
                href={seasonHref(seriesId, seriesName, season.season_number)}
                className="hover:bg-paper-sunk/60 -mx-2 flex items-baseline justify-between gap-4 px-2 py-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="text-body text-ink">{season.name}</span>
                  {first ? (
                    <span className="text-meta text-ink-faint ml-2">{first}</span>
                  ) : null}
                </span>

                <span className="text-meta text-ink-faint shrink-0 text-right tabular-nums">
                  {!known
                    ? `${season.episode_count} ${
                        season.episode_count === 1 ? "episode" : "episodes"
                      }`
                    : vouched
                      ? `${watched} of ${season.episode_count}`
                      : watched > 0
                        ? `${watched} watched`
                        : pendingLabel(season)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * What to say about a season with no trustworthy denominator, in place of a count.
 *
 * Three different things get excluded from the census and they are not the same news:
 * a season TMDB has announced with no episodes yet, one with a premiere still to come, and
 * one broadcasting week by week right now. Collapsing them into one word would be the
 * cheaper thing to write and would tell the reader least at the moment they most want to
 * know why the number is missing.
 */
function pendingLabel(season: Season): string {
  if (season.episode_count === 0) return "Announced";
  if (season.air_date && season.air_date > today()) return "Not yet aired";
  return "Airing now";
}

function alwaysTrue() {
  return true;
}

function alwaysFalse() {
  return false;
}
