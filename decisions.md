# Decisions

Written as the decisions are made, not reconstructed afterwards. Each entry records what
was chosen **and what was rejected**, because the rejected option is the part that shows
the thinking.

---

## 1. The product is about connections, not logging

**2026-08-08.** Ensemble is not trying to be a better watchlist. Watchlists are solved —
Trakt, Simkl, Serializd, Moviebase and a dozen others do it competently. The thing none of
them do well is show you the **shape** of what you watch: which films belong to the same
franchise, which faces keep recurring across the things you love, and whether a series you
are about to start was cancelled three years ago on a cliffhanger.

**Rejected: building a general-purpose tracker with these as features.** That framing puts
Ensemble in a category where it loses on completeness to apps with years of work behind
them, and it buries the only interesting part. Leading with the connections makes the
feature set a consequence of a position rather than a list.

**Consequence for scope:** anything that does not serve "see the connections" is out, even
when it is cheap. That rule has already cut ratings aggregation, social features and
recommendations-as-a-product.

---

## 2. Name: Ensemble

**2026-08-08.** Shortlisted Throughline, Canon, Ensemble, Runtime and Bingeworthy, then
checked registration status for each across `.com`, `.tv`, `.app`, `.watch`, `.show`,
`.film` and `.directory` via RDAP, and checked for existing products in the category.

*Ensemble* carries both differentiators in one word: an ensemble is a cast, and an ensemble
is also a set of things regarded as a whole — which is exactly what a franchise view does.

**Rejected:**

- **Throughline** — the best fit to the thesis and by far the most crowded name. It is
  already a screenwriting and story-structure app, which is a *film-adjacent* collision, plus
  a therapy app, a crisis-support platform and an enterprise AI product. `.com`, `.tv`,
  `.app` and `.film` all registered.
- **Canon** — franchise-native vocabulary and an unusually clean domain sweep, but it only
  covers the franchise half of the thesis, carries a famous-mark trademark complication, and
  a five-letter dictionary word is the most likely of the set to sit in a registry premium
  tier.
- **Bingeworthy** — the front-runner going in, rejected on category saturation. Binged,
  BingeBoxd, Bingers, BingeList and Watchworthy already exist; a name in that convention
  reads as the fifth variation on a theme before anyone opens the app. `bingeworthy.com` is
  also a live media product.
- **Runtime** — a genuine three-way pun (film runtime, program runtime, "is it still
  running") but `.tv`, `.watch`, `.show` and `.app` are all taken.

---

## 3. No accounts, no backend, no database

**Carried from the project spec, 2026-07-28.** Watch status, favourites and episode progress
live in `localStorage`.

**Rejected: auth plus a hosted database.** It is the single largest block of work available
and it proves nothing anyone is asking about. Nobody assessing this cares that state is
local; they care whether the interactions are right.

**The interesting consequence:** with no account, there is no sync — so the answer to "how do
I move my data" has to be **export and import as a file**. That is the design answer to the
constraint, not a consolation prize, and it happens to put file handling, parsing, schema
validation and error states on the board for a few hours of work.

---

## 4. Every TMDB call runs on the server

**2026-08-08.** `src/lib/tmdb.ts` imports `server-only`, so if a client component ever
imports it the **build fails** rather than shipping the access token to a browser. Data is
fetched in server components; the token never enters the client bundle.

**Rejected: calling TMDB directly from the browser** with the key in
`NEXT_PUBLIC_TMDB_KEY`. This is what most tutorial builds of this app do, and it works —
TMDB read tokens are low-privilege. It was rejected because a key in a public repo's client
bundle is a bad habit made visible, and because server-side fetching unlocks Next's data
cache (see 6) which the client approach cannot use.

**Consequence:** this is the decision that ruled out static export to the existing Namecheap
pipeline, and it is why the app deploys to Vercel.

---

## 5. Search state lives in the URL

**2026-08-08.** The query is a `?q=` search param read by a server component, not React
state in a client component.

**Rejected: a client component holding query state and fetching as you type.** It gives
instant feedback, which is genuinely better, and it is the obvious way to build this.

**Why the URL won anyway:** a result set becomes shareable, the back button behaves the way
users expect rather than exiting the search entirely, and the page can render on the server —
which is what makes decision 4 possible at all. The instant-feedback loss is recoverable: a
debounced client input that pushes to the same URL gets both, and can be added later without
changing the data layer. Building it the other way round would have meant rewriting the
data layer to add server rendering.

**This is a case where an implementation constraint improved the design** rather than
compromising it, which is worth saying plainly because it usually goes the other way.

---

## 6. Caching at the fetch layer, not the client

**2026-08-08.** `tmdb()` sets `next: { revalidate: 3600 }`. Film and series metadata changes
rarely, so an hour-long window costs nothing in freshness and removes almost all repeat calls
to TMDB.

**Rejected: a client-side cache (React Query or SWR).** Both are good, and both solve a
problem this app does not have — they cache *in the browser*, which requires the browser to
be the thing making the requests, which contradicts decision 4.

**Known tension, unresolved:** the common-actors feature (see 8) needs credits for every
favourited title, which is N requests. An hour-long cache helps a lot but does not answer
whether those are fetched on demand or at favourite-time. Deferred to that block.

---

## 7. Self-hosted fonts via `next/font`

**2026-08-08.** Fonts are downloaded at build time and served from the app's own origin.

This looks like it contradicts the standing rule to avoid Google Fonts (Google Fonts loaded
from Google's CDN set cookies, which triggers a consent banner). It does not: `next/font`
self-hosts the files, so the browser makes **zero third-party requests**. The rule's intent —
no third-party tracking, no cookie banner — is satisfied. The rule's letter is about the CDN,
which is not what is happening here.

**Rejected: linking Google Fonts from `fonts.googleapis.com`**, which would have required a
consent banner for a portfolio app that otherwise sets no cookies at all.

---

## 8. Episode-level watch tracking, not season-level

**2026-08-08.** Marking progress works per episode, not just per series or per season.

**Rejected: season-level only**, which was the recommendation. Season-level costs ~2h;
episode-level costs ~5h, because it needs a season endpoint per season, an episode-list
screen, a three-level state tree (series → season → episode), roll-up logic for partial
seasons, and a correspondingly larger export schema.

**Chosen anyway, with the cost stated up front**, on the grounds that partial progress is the
actual experience of watching television and rounding it to whole seasons is the kind of
simplification that makes an app feel like a demo.

---

## 9. Tailwind, but never stock Tailwind

**2026-08-08.** Styling is Tailwind 4 with a **bespoke token layer** — colour, type and
spacing defined once as CSS custom properties that Tailwind consumes — rather than reaching
for the framework's default scales.

**Rejected: CSS Modules.** A hand-written stylesheet would have produced the same visual
result and is arguably a purer demonstration of CSS ability. Tailwind won because it is what
a frontend team at a product company actually uses, so the code reads as employable rather
than as a personal preference.

**Rejected more emphatically: stock Tailwind defaults.** `bg-slate-50`, `text-gray-900`, the
default type scale — these are the visual signature of a tutorial project, and they are
recognisable at a glance to exactly the people this project is meant to persuade. Using a
framework is fine; letting the framework make the design decisions is the thing to avoid.
The tokens are where the design lives; Tailwind is only the delivery mechanism.

---

## 19. A franchise is a numbered run, in release order

**2026-08-08.** `/franchise/8091-alien` lists every film in the collection as a numbered
sequence, in the order they came out, with the number set in the spot colour.

**The number is the entire point of the view.** A search result can tell you a film exists;
only a sequence can tell you it is the third of four, and that is the thing that was missing
from the app this replaced.

**Rejected: in-universe chronology.** Some franchises have a story order that differs from
release order — prequels, interquels, the *Star Wars* problem. In-universe order is arguably
more useful for a first watch, and it was rejected because **TMDB does not carry it**.
Building it would mean hand-curating an ordering per franchise, which is exactly the
hand-maintained data this project avoids on principle: the reason franchise view is tractable
at all is that collections are a first-class TMDB concept.

**Rejected: sorting undated entries first.** An announced sequel with no release date sorts
to the top on an empty string comparison. They go last instead — a film that does not exist
yet is not the beginning of the run.

---

## 20. "Collection" is TMDB's filing word, not the franchise's name

**2026-08-08.** TMDB names collections "Alien Collection", "The Lord of the Rings
Collection". The suffix is a cataloguing convention, so it is stripped: the page reads *The
Lord of the Rings*, and the film page links "Part of the Alien franchise".

**Rejected: showing TMDB's string verbatim**, which is safer and needs no rule. It produces
"Part of Alien Collection" — a seam that makes an app feel assembled rather than designed.

**The strip is conditional, not assumed.** It only fires when the suffix is actually there,
so a collection named anything else survives untouched instead of being mangled by a rule
that assumed a pattern held everywhere.

---

## 21. Titles never truncate

**2026-08-08.** Titles wrap. They previously carried `truncate`, which is the reflex for
keeping a row tidy.

**Found by looking at the franchise view, which is the worst case for it.** Every entry in a
run shares a long prefix, so clipping the end removes the only words that distinguish them:
*"The Lord of the Rings: The Fellowship of…"* and *"The Lord of the Rings: The Return of…"*
are the same string until precisely the part that gets cut. A tidy row that cannot tell you
which film it is has optimised for the wrong thing.

**Rejected: shrinking the title size on franchise pages** so more fits on one line. That
fixes the symptom in one view, leaves search results clipping the same titles, and makes the
franchise page inconsistent with every other page for no reason a reader could infer.

Verified by asserting the invariant rather than looking: `scrollWidth > clientWidth` is now
false for every title on the page.

---

## 16. The cast is a credit block, not an avatar carousel

**2026-08-08.** Cast renders as a ruled two-column table — small plate, name, character —
with the first twelve shown and the remainder counted ("and 94 more" on *Avengers: Endgame*).

**Rejected: the horizontally scrolling row of circular avatars** that every media app uses.
It costs two things Ensemble cannot afford: it hides most of the cast behind a gesture, and
it drops the character name because there is no room under a circle.

For an app whose argument is the connections between people and titles, the cast is not
decoration at the bottom of a page — it is the primary content. So it gets read like a
printed credit block, with everything visible at once.

---

## 17. Released and announced work are separated

**2026-08-08.** A person's filmography is split: released work newest-first, then a quieter
"Announced" section for anything dated in the future.

**This was a bug I built and then found.** The first version was straight
reverse-chronological, which is defensible and honest. Rendered against real data it opened
Scarlett Johansson's page on *The Batman: Part II* (2028), *The Exorcist: Martyrs* (2027) and
three more films that do not exist — pushing everything she is actually known for below the
fold. Worse, showing a 2028 announcement in the same treatment as a 1994 film quietly implies
it exists.

**Rejected: sorting by popularity instead**, which is what most apps do and which solves the
vapourware problem by accident. It creates a different one — a career reads as a greatest-hits
list with no shape, and recent work disappears under whatever was most successful a decade
ago.

**Undated credits stay at the end of *released*, not in *announced*.** An undated credit is
unknown, not forthcoming, and putting it under a heading that claims it is coming would be
inventing information TMDB does not have.

---

## 18. One request per page, not two

**2026-08-08.** Detail pages use TMDB's `append_to_response` to inline sub-resources — a
film fetches its credits in the same call as its detail, and a person fetches an entire
combined filmography in one.

**Rejected: separate calls**, parallelised with `Promise.all`. That is the more obvious
shape and reads more cleanly. It was rejected because two round trips to TMDB cost real
latency on a server-rendered page where nothing paints until the data arrives, and because
each extra call is another thing that can fail independently and needs its own error path.

**The tension this creates, noted for later:** `append_to_response` is per-request, so it
cannot help the common-actors feature, which needs credits for *every* favourited title.
That one still has N requests to solve and is deferred to its own block — see #6.

---

## 22. Films and series are separate filmographies

**2026-08-10.** A person's work splits into two sections — Films and Series — each carrying
its own count and its own full page. It was one reverse-chronological list of everything.

**The page was unreadable at real scale, and the numbers are the argument.** Samuel L.
Jackson's page rendered **340 rows**; Morgan Freeman's 269; Scarlett Johansson's interleaved
102 films with 72 television credits in one stream. A career is not one list.

**Rejected: one list with a category label on each row.** Cheaper, and it preserves strict
chronology across a whole career, which is a real thing to want. It loses to the split
because the two are different commitments — a film is an evening, a series is a season — and
because the app already says *Film* and *Series* everywhere else, including in the URL (#14).
The filmography was the last surface still speaking TMDB's flat vocabulary.

**Announced work stays in one section spanning both kinds.** Rejected: splitting it too, for
symmetry. It runs to a handful of rows — two for Jackson, four for Johansson — and four
headings to carry six rows spends page structure on the least certain material there is. It
gets a per-row category label instead, since it is the one list where a row cannot inherit
its category from the heading above it.

---

## 23. A talk-show appearance is not a credit — but a one-episode role is

**2026-08-10.** Credits where the character is *Self*, *Himself* or *Herself* are held back
from the filmography and reported as a count: **"64 appearances as themselves, not listed."**

**TMDB records a Graham Norton sofa exactly as it records Walter White**, and for a working
actor the sofas are most of the television list — 63 of Scarlett Johansson's 72 series
credits, 42 of Bryan Cranston's 107, 64 of Jackson's 256 film credits. Nothing about the row
says which is which except the character.

**Rejected: also dropping series with fewer than two episodes**, which was the other half of
this rule when I proposed it, and which I was confident about. Measured against real data it
deleted **Cranston in *Babylon 5*, *3rd Rock from the Sun* and *Airwolf*, and Elijah Wood in
*Frasier* and *Homicide: Life on the Street*.** A one-episode guest role is still a role, and
an anthology lead appears exactly once by design. It was also simply unnecessary: the self
test alone takes Johansson's 72 series credits to 9. **The rule survived being written down
and died on contact with the data, which is the whole reason to measure before shipping a
filter rather than after.**

**Rejected: filtering silently.** Every place the filter runs says how much it withheld. A
list that quietly drops two thirds of its input is indistinguishable from a list that is
broken, and the reader has no way to tell which they are looking at.

**Known edge, kept on purpose.** Deduplication keeps the more descriptive of two rows for the
same title, so *The Late Late Show* survives on Jackson's page: TMDB has him there twice, once
as *Self* and once as *"An Officer of the Law"*, and the filter only ever sees the surviving
row. Closing that hole means deleting a credited character to tidy a list, which is precisely
what the paragraph above refused to do.

---

## 24. A capped section with its own page behind it, not a carousel

**2026-08-10.** Each section shows twelve credits and links to a page holding the whole run —
`/person/2231-samuel-l-jackson/films`.

**The proposal on the table was a horizontal carousel per section**, the pattern Moviebase,
IMDb, Rotten Tomatoes and TMDB all use on every screen. Rejected for three reasons, in
ascending order of weight:

- It is **the component #16 already rejected by name** for the cast block, and for a reason
  that applies harder here: there is no room for a character under a poster, and *Bryan
  Cranston as Walter White* is what makes a filmography a filmography rather than a wall.
- It compresses **#11's tile grid into a single row**. The grid is the layout that flattens
  structure — which film precedes which, which face recurs — and structure is what this app
  exists to show.
- It is the most recognisable **storefront** component there is, and it costs the one sentence
  the design has earned: *the reference apps are storefronts; this is a reference book.*

**The interaction that was actually wanted — show some, offer the rest — already existed in
the app** as #16's "and 94 more". This is that pattern with an address.

**Rejected: expanding in place.** Cheaper, no second route, and no empty state to design. A
real page won because a filmography is a thing people link to, and "Samuel L. Jackson's 190
films" deserves to have somewhere to point.

**The pages cost nothing extra to serve.** `combined_credits` already rides along on the
person response (#18), so both of them re-read one cached fetch rather than issuing a request
of their own.

---

## 25. A rule written wider than it was applied

**2026-08-10.** #21 says *titles never truncate*. That was true of the franchise view, where
the problem was found, and false everywhere else: the person page still carried `truncate` on
both the title and the character line, and shipped that way.

**The person page is a worse case than the franchise page that prompted the rule.** A
franchise run at least numbers its entries, so a clipped title is still locatable. A
filmography has nothing but the title, and an actor who has been in four films with a shared
prefix loses the only words that tell them apart.

**Nothing was wrong with the decision. What was wrong is that writing it down felt like
having fixed it** — and a rule recorded in this file is not a check that runs. The thing that
would have caught it is the assertion #21 itself describes, `scrollWidth > clientWidth`, run
somewhere other than the page that prompted it. It now returns **0 across 52 titles and
character lines** on Jackson's page.

---

## 14. URLs use the product's vocabulary, not the API's

**2026-08-08.** Routes are `/film/348-alien` and `/series/1437-firefly`.

**Rejected: `/movie/348` and `/tv/1437`**, which is what TMDB calls them and would have meant
one less translation layer.

The interface says *Film* and *Series* everywhere a category is shown, and a URL is part of
the interface — it is the one piece of an app people copy, paste and read aloud. Matching the
address bar to the product's own words rather than a vendor's internal naming costs one
mapping function and keeps the whole surface speaking one language.

**The slug is cosmetic and deliberately so.** The id is parsed off the front, so
`/film/348-alien`, `/film/348` and a stale `/film/348-old-title` all resolve to the same
page. A link that has been sitting in someone's notes for a year should not break because a
title was edited upstream.

---

## 15. "Ended" and "Cancelled" are different words, and the difference is the product

**2026-08-08.** TMDB reports series status as `Ended`, `Canceled`, `Returning Series`,
`Planned`, `In Production` or `Pilot`. Ensemble maps those to four standings and gives each
a different typographic weight:

- **Cancelled** takes the spot colour. It is a warning: the story was cut off.
- **Still running** takes the green. It is an invitation, and also a caution about waiting.
- **Ended** is deliberately *quiet*, in muted ink. "It finished properly" is reassurance, and
  reassurance does not need to shout.

**Rejected: one neutral status chip** showing whatever string TMDB returned. That is what
most trackers do when they show status at all, and it flattens the only distinction that
actually changes a decision. *Ended* and *Cancelled* are three letters apart in a database
and worlds apart to someone deciding whether to commit thirty hours.

**Verified against real data:** Firefly renders `Series · 2002 · 1 season · 11 episodes ·
CANCELLED` in rust; Breaking Bad renders `2008–2013 · 5 seasons · 62 episodes · ENDED` in
muted ink; Law & Order: SVU renders `1999– · 28 seasons · 595 episodes · STILL RUNNING` in
green. The open-ended range for running series and the single year for a show that lasted one
year both fall out of the same formatter.

---

## 11. Editorial and light, not dark and cinematic

**2026-08-08.** A repertory cinema programme or a film reference book: warm paper ground,
Newsreader carrying titles, Archivo carrying metadata, one spot colour, generous whitespace.

**Rejected: dark cinematic** — near-black ground, poster-forward, gradient scrims over hero
art. It is a genuinely good option. TMDB's artwork looks superb on black for no effort, and
it is instantly legible to anyone who has used a streaming service.

**It was rejected because that familiarity is the problem, in two ways.**

First, it is what the entire category already does, so it demonstrates no judgement. Against
someone who has seen many of these, "the same, slightly nicer" is not an argument.

Second and more importantly, **the tile grid fights the thesis.** A wall of posters says
*browse content*. Every item becomes an interchangeable rectangle, and structure — which
film precedes which, which face recurs, which series stopped — becomes invisible. An app
whose whole claim is about connections cannot use the layout that flattens them.

**Known risk, accepted:** light editorial is harder to make feel media-native, and posters on
warm white can read clinical if the spacing is wrong. Mitigated by treating images as plates
with a rule around them rather than as bleed-to-edge tiles.

---

## 12. Light first, dark deferred to last

**2026-08-08.** No `prefers-color-scheme` branch for now. The scaffold's dark-mode block was
removed rather than extended.

**Rejected: designing both at once.** The direction in #11 is *specifically* a paper ground,
and a printed programme has no dark variant — so a dark Ensemble is a **second design**, not
this one inverted. Building both in parallel means every token decision gets litigated twice
before either is settled, and the cheap escape (an automatic inversion) would undermine the
one thing the visual design exists to prove.

**Also rejected: cutting it entirely**, which was the original call. Overruled by the person
who will actually use this every day and reads everything in dark mode. That is the right
reason to overrule it — the app has a real user with a real preference, and designing against
that to protect a purist argument about paper would be precious.

**So: scheduled, not parked.** Dark mode ships as one of the last pieces before launch, once
the light design has stopped moving and there is a fixed thing to translate rather than a
moving one. Roughly an hour; the token layer is built so it is a second set of values, not a
rewrite.

---

## 13. Search results are a catalogue, not a grid

**2026-08-08.** Results render as a ruled vertical list — plate, title, category, year,
two lines of synopsis — rather than as a poster grid.

**Rejected: the poster grid**, which is the category default and fits more results per
screen.

The list won because it shows *more per item* rather than more items: category, year and
synopsis are all visible without a hover or a tap, which is what makes the thing feel like a
reference tool instead of a storefront. It also scales down to narrow screens without a
breakpoint, since a single column is already the layout.

**The honest tradeoff:** scanning twenty results takes more scrolling than a grid would. For
a tool where you usually know what you are looking for, that is the right side of the trade —
but it would be the wrong one for a browse-first product.

---

## 10. Deliberately ugly until the design block

**2026-08-08.** The scaffold's search page uses unstyled defaults on purpose. Design
decisions get made in one dedicated pass with the whole surface in view, not accreted while
wiring up data.

**Rejected: styling as I go**, which feels faster and produces a design that is the sum of
whatever seemed reasonable at each step. The visual identity is one of the two things this
project exists to demonstrate; it does not get made by accident.
