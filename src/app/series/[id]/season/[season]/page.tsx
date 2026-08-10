import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tmdb, TmdbError } from "@/lib/tmdb";
import {
  type SeasonDetail,
  type TvDetail,
  formatDate,
  parseId,
  seasonCensus,
  seriesHref,
  seasonHref,
  year,
} from "@/lib/types";
import { Masthead, SearchField } from "@/components/masthead";
import { EpisodeList } from "@/components/episode-list";

interface SeriesWithSeason extends TvDetail {
  [key: `season/${number}`]: SeasonDetail | undefined;
}

/**
 * Series and season in one request.
 *
 * TMDB will inline a season on the series detail response, which is what keeps this page
 * inside #18. Appending *every* season was measured and rejected: Grey's Anatomy with twenty
 * seasons attached is a 2.25 MB response against 50 KB for one, and its twenty-three seasons
 * exceed the twenty TMDB will append at all — so the page that would have shown everything
 * cannot even be built for the show that most needs it.
 *
 * The series half is not incidental. This page needs the name and standing for its header,
 * the season list for its navigation, and the census for the roll-up, and all three arrive
 * here for nothing.
 */
async function getSeason(idParam: string, seasonParam: string) {
  const id = parseId(idParam);
  const season = Number.parseInt(seasonParam, 10);
  if (id === null || !Number.isInteger(season) || season < 0) notFound();

  try {
    const series = await tmdb<SeriesWithSeason>(`/tv/${id}`, {
      append_to_response: `season/${season}`,
    });

    const detail = series[`season/${season}`];
    // TMDB answers 200 with the season key simply absent when the season does not exist,
    // so a missing key is this route's 404 rather than an error to propagate.
    if (!detail) notFound();

    return { series, detail };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/series/[id]/season/[season]">): Promise<Metadata> {
  const { id, season } = await params;
  try {
    const { series, detail } = await getSeason(id, season);
    return { title: `${series.name}: ${detail.name} — Ensemble` };
  } catch {
    return { title: "Ensemble" };
  }
}

export default async function SeasonPage({
  params,
}: PageProps<"/series/[id]/season/[season]">) {
  const { id, season } = await params;
  const { series, detail } = await getSeason(id, season);

  const census = seasonCensus(series);

  // Ordered rather than trusted: TMDB lists seasons in order today, and neighbouring pages
  // would silently swap if it ever stopped.
  const ordered = [...series.seasons].sort((a, b) => a.season_number - b.season_number);
  const at = ordered.findIndex((s) => s.season_number === detail.season_number);
  const previous = at > 0 ? ordered[at - 1] : null;
  const next = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;

  const aired = formatDate(detail.air_date);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-8">
      <Masthead compact />
      <SearchField />

      <article className="pt-10">
        <Link
          href={seriesHref(series.id, series.name)}
          className="label text-ink-faint hover:text-ink transition-colors"
        >
          {series.name}
          {year(series.first_air_date) ? ` (${year(series.first_air_date)})` : ""}
        </Link>

        <h1 className="editorial text-display text-ink mt-2">{detail.name}</h1>

        <p className="label text-ink-muted mt-3">
          {[
            `${detail.episodes.length} ${
              detail.episodes.length === 1 ? "episode" : "episodes"
            }`,
            aired ? `from ${aired}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <EpisodeList
          seriesId={series.id}
          season={detail.season_number}
          episodes={detail.episodes}
          census={census}
        />

        <nav className="border-rule mt-10 flex items-baseline justify-between gap-6 border-t pt-6">
          {previous ? (
            <Link
              href={seasonHref(series.id, series.name, previous.season_number)}
              className="label text-ink-faint hover:text-ink transition-colors"
            >
              ← {previous.name}
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <Link
              href={seasonHref(series.id, series.name, next.season_number)}
              className="label text-ink-faint hover:text-ink text-right transition-colors"
            >
              {next.name} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </div>
  );
}
