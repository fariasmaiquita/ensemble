/**
 * An example library, for the reviewer who opens this app with nothing in it.
 *
 * **This is the home page's hardest problem, and it is a portfolio problem before it is a
 * product one.** Every section on this page is computed from your own data, by decision — so
 * somebody arriving for the first time is shown five headings and nothing under them, and
 * the strongest argument for putting the world's data on this page is exactly that. The
 * answer taken instead is to hand them a library.
 *
 * **It writes into the real store, through the real code path.** A preview mode reading from
 * a parallel source was rejected: a demonstration that is not the product demonstrates
 * nothing, and what makes this convincing is that you can toggle a status on a seeded title
 * and watch the sections rearrange around it, because that is not a simulation of the app.
 *
 * **Offered only when the library is empty**, which is what makes removing it safe: there
 * was nothing here to overwrite, and the removal names the titles it wrote rather than
 * clearing whatever it finds.
 *
 * Chosen to exercise every section, and the entries are real: the labels and poster paths
 * were read from TMDB rather than typed from memory. The favourites are also doing work —
 * Aliens, The Terminator and Titanic put Bill Paxton in three of them, and Jenette Goldstein
 * in Aliens and Titanic, which is a connection nobody would have gone looking for and is
 * precisely what the faces section exists to find.
 */

import {
  type Library,
  type LibraryEntry,
  type SeriesProgress,
  replaceLibrary,
  removeTitles,
  titleKey,
} from "./library";

/** Marks a library that started life as the example, so the page can offer to remove it. */
const FLAG_KEY = "ensemble:example";

type Seed = Omit<LibraryEntry, "updatedAt"> & { daysAgo: number };

const FILMS: Seed[] = [
  {
    kind: "film",
    id: 348,
    title: "Alien",
    year: "1979",
    posterPath: "/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    status: "watched",
    favourite: true,
    daysAgo: 26,
  },
  {
    kind: "film",
    id: 679,
    title: "Aliens",
    year: "1986",
    posterPath: "/r1x5JGpyqZU8PYhbs4UcrO1Xb6x.jpg",
    status: "watched",
    favourite: true,
    daysAgo: 24,
  },
  {
    kind: "film",
    id: 218,
    title: "The Terminator",
    year: "1984",
    posterPath: "/qvktm0BHcnmDpul4Hz01GIazWPr.jpg",
    status: "watched",
    favourite: true,
    daysAgo: 19,
  },
  {
    kind: "film",
    id: 597,
    title: "Titanic",
    year: "1997",
    posterPath: "/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg",
    status: "watched",
    favourite: true,
    daysAgo: 12,
  },
  {
    kind: "film",
    id: 244786,
    title: "Whiplash",
    year: "2014",
    posterPath: "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
    status: "watched",
    favourite: true,
    daysAgo: 5,
  },
];

const SERIES: Seed[] = [
  {
    // No claimed status at all, deliberately: the ticked episodes are what make this say
    // "Watching", which is the roll-up (#38) demonstrating itself in the example.
    kind: "series",
    id: 1396,
    title: "Breaking Bad",
    year: "2008",
    posterPath: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
    status: null,
    favourite: false,
    daysAgo: 2,
  },
  {
    kind: "series",
    id: 95396,
    title: "Severance",
    year: "2022",
    posterPath: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg",
    status: null,
    favourite: true,
    daysAgo: 9,
  },
  {
    kind: "series",
    id: 67744,
    title: "MINDHUNTER",
    year: "2017",
    posterPath: "/fbKE87mojpIETWepSbD5Qt741fp.jpg",
    status: "want",
    favourite: false,
    daysAgo: 15,
  },
  {
    kind: "series",
    id: 90669,
    title: "1899",
    year: "2022",
    posterPath: "/gZleGu1MQVBArH2dlpZ9CGi0hhy.jpg",
    status: "want",
    favourite: false,
    daysAgo: 31,
  },
];

/**
 * Episodes ticked, written out rather than generated.
 *
 * Severance is every episode that had aired when this was written, which is what puts it
 * under *Caught up* — and **that will not stay true**. When its next season starts, the
 * example moves itself into *Continue watching* with an episode waiting. That is a demo
 * ageing into a different demo rather than into a broken one, and the alternative — asking
 * TMDB what has aired before seeding — would mean the example could not be created until a
 * network request came back.
 */
const PROGRESS: Record<string, SeriesProgress> = {
  // Series one in full, then four episodes into series two: next up is S2 E5.
  "1396": {
    "1": [1, 2, 3, 4, 5, 6, 7],
    "2": [1, 2, 3, 4],
  },
  "95396": {
    "1": [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "2": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};

const SEEDS = [...FILMS, ...SERIES];

export const EXAMPLE_SIZE = { films: FILMS.length, series: SERIES.length };

function build(): Library {
  const entries: Record<string, LibraryEntry> = {};
  const now = Date.now();

  for (const { daysAgo, ...seed } of SEEDS) {
    entries[titleKey(seed.kind, seed.id)] = {
      ...seed,
      // Spread over the past month rather than stamped identically, because every section
      // here orders by `updatedAt` and a library written in one instant has no order at all.
      updatedAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    };
  }

  return { version: 1, entries, progress: PROGRESS };
}

export function loadExample() {
  replaceLibrary(build());
  try {
    window.localStorage.setItem(FLAG_KEY, "1");
  } catch {
    // Storage refusing the flag is the same browser that refused the library. The example
    // still works for this session; it simply cannot be marked as one.
  }
}

/** Remove exactly what the example wrote, leaving anything added since. */
export function removeExample() {
  removeTitles(SEEDS.map((seed) => titleKey(seed.kind, seed.id)));
  try {
    window.localStorage.removeItem(FLAG_KEY);
  } catch {
    /* nothing to undo */
  }
}

export function isExample(): boolean {
  try {
    return window.localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
