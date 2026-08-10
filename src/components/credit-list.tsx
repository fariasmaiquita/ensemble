import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { type CreditItem, creditHref, creditTitle, creditYear } from "@/lib/types";
import { Plate } from "./plate";

/**
 * A person's credits as a ruled list — the same reading gesture as the cast block and the
 * search catalogue, so a title looks the same wherever it appears in the app.
 *
 * Nothing here truncates. See decisions.md #21 and #23: clipping the end of a title removes
 * exactly the words that distinguish one entry in a run from the next.
 */
export function CreditList({
  credits,
  showCategory = false,
}: {
  credits: CreditItem[];
  /**
   * Set on the announced section, which is the one place films and series share a list and
   * so the only place a row cannot get its category from the heading above it.
   */
  showCategory?: boolean;
}) {
  return (
    <ul className="divide-rule divide-y">
      {credits.map((credit) => (
        <li key={`${credit.media_type}-${credit.id}`}>
          <Link
            href={creditHref(credit)}
            className="hover:bg-paper-sunk/60 -mx-3 flex items-center gap-4 px-3 py-3 transition-colors"
          >
            <Plate src={posterUrl(credit.poster_path)} size="mini" alt="" />

            <div className="min-w-0 flex-1">
              <p className="text-body text-ink">{creditTitle(credit)}</p>

              {credit.character ? (
                <p className="text-meta text-ink-faint italic">{credit.character}</p>
              ) : null}

              {showCategory ? (
                <p className="label text-ink-faint mt-1">
                  {credit.media_type === "movie" ? "Film" : "Series"}
                </p>
              ) : null}
            </div>

            <span className="label text-ink-faint shrink-0 tabular-nums">
              {creditYear(credit) ?? "—"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
