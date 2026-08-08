import Link from "next/link";
import { posterUrl, profileUrl } from "@/lib/tmdb";
import {
  type MultiSearchResult,
  displayTitle,
  isPerson,
  mediaHref,
  releaseYear,
} from "@/lib/types";
import { Plate } from "./plate";

export function ResultRow({ result }: { result: MultiSearchResult }) {
  const person = isPerson(result);
  const image = person ? profileUrl(result.profile_path) : posterUrl(result.poster_path);
  const year = releaseYear(result);
  const category = person ? "Person" : result.media_type === "movie" ? "Film" : "Series";

  return (
    <li>
      <Link
        href={mediaHref(result)}
        className="hover:bg-paper-sunk/60 -mx-3 flex gap-5 px-3 py-6 transition-colors"
      >
        <Plate src={image} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="editorial text-title text-ink truncate">
              {displayTitle(result)}
            </h2>
            {year ? (
              <span className="label text-ink-faint shrink-0 tabular-nums">{year}</span>
            ) : null}
          </div>

          <p className="label text-ink-muted mt-1.5">
            {category}
            {person && result.known_for_department
              ? ` · ${result.known_for_department}`
              : ""}
          </p>

          {!person && result.overview ? (
            <p className="text-meta text-ink-muted mt-2.5 line-clamp-2">{result.overview}</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
