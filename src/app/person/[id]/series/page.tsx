import type { Metadata } from "next";
import { getPerson } from "@/lib/person";
import { filmography } from "@/lib/types";
import { FilmographyPage } from "@/components/filmography-page";

export async function generateMetadata({
  params,
}: PageProps<"/person/[id]/series">): Promise<Metadata> {
  const { id } = await params;
  try {
    const person = await getPerson(id);
    return { title: `${person.name}: series — Ensemble` };
  } catch {
    return { title: "Ensemble" };
  }
}

export default async function PersonSeriesPage({ params }: PageProps<"/person/[id]/series">) {
  const { id } = await params;
  const person = await getPerson(id);
  const work = filmography(person.combined_credits?.cast ?? []);

  return (
    <FilmographyPage
      person={person}
      group={work.series}
      eyebrow="Series"
      noun={{ one: "series", many: "series" }}
    />
  );
}
