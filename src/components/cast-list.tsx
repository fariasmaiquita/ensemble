import Link from "next/link";
import { profileUrl } from "@/lib/tmdb";
import { type CastMember, personHref } from "@/lib/types";
import { Plate } from "./plate";

/**
 * Cast is shown as a ruled two-column table rather than a horizontally scrolling row of
 * circular avatars.
 *
 * The carousel is what every media app uses, and it has two costs this app cannot pay: it
 * hides most of the cast behind a gesture, and it drops the character name to fit. Since
 * the point of Ensemble is the connections between people and titles, the cast list is
 * primary content — so it gets read like a credit block, all of it visible at once.
 */
export function CastList({ cast, limit = 12 }: { cast: CastMember[]; limit?: number }) {
  const shown = cast.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <section className="border-rule mt-10 border-t pt-8">
      <h2 className="label text-ink-faint">Cast</h2>

      <ul className="mt-4 grid gap-x-10 sm:grid-cols-2">
        {shown.map((member) => (
          <li key={`${member.id}-${member.character}`} className="border-rule border-t">
            <Link
              href={personHref(member.id, member.name)}
              className="hover:bg-paper-sunk/60 -mx-2 flex items-center gap-3 px-2 py-2.5 transition-colors"
            >
              <Plate
                src={profileUrl(member.profile_path)}
                size="mini"
                align="center"
                alt=""
              />
              {/*
                Nothing here truncates — as a guard, not as a bug fix, and the distinction is
                worth recording because the bug it was meant to fix did not exist.

                Measured at real viewport widths, no cast cell clips: 0 of 216 across nine
                films at 640px, the tightest point where the two-column grid applies, and 0 at
                375px where the grid collapses to one column. The `truncate` this replaces was
                never firing.

                It comes out anyway because the alternative is a component that is correct by
                luck. #16 says the character name is why this is a table rather than a
                carousel, and leaving in a rule that deletes character names — dormant only
                because today's names happen to be short enough — makes the whole argument
                contingent on the data. Uneven row heights are the cost; on a ruled list they
                read as typesetting.
              */}
              <span className="min-w-0">
                <span className="text-meta text-ink block">{member.name}</span>
                {member.character ? (
                  <span className="text-meta text-ink-faint block italic">
                    {member.character}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {cast.length > shown.length ? (
        <p className="label text-ink-faint mt-4">
          and {cast.length - shown.length} more
        </p>
      ) : null}
    </section>
  );
}
