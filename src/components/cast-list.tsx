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
              <Plate src={profileUrl(member.profile_path)} size="mini" alt="" />
              <span className="min-w-0">
                <span className="text-meta text-ink block truncate">{member.name}</span>
                {member.character ? (
                  <span className="text-meta text-ink-faint block truncate italic">
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
