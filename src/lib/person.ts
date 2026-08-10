import { notFound } from "next/navigation";
import { tmdb, TmdbError } from "@/lib/tmdb";
import { type CombinedCredits, type PersonDetail, parseId } from "@/lib/types";

export interface PersonWithCredits extends PersonDetail {
  combined_credits: CombinedCredits;
}

/**
 * Shared by the person page and the two full-filmography pages behind it.
 *
 * All three want the same response, so they make the same request and let the fetch cache
 * (see decisions.md #6) collapse it — rather than each holding its own copy of the fetch,
 * which is how the three drift apart.
 */
export async function getPerson(param: string): Promise<PersonWithCredits> {
  const id = parseId(param);
  if (id === null) notFound();

  try {
    // One request rather than two: TMDB will inline a sub-resource on the detail response.
    return await tmdb<PersonWithCredits>(`/person/${id}`, {
      append_to_response: "combined_credits",
    });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}
