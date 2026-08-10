import Image from "next/image";

/**
 * A poster or profile image, treated as a plate in a book: fixed, ruled, and captioned by
 * the text beside it — rather than as a tile in a grid. See decisions.md #11.
 */
export function Plate({
  src,
  alt = "",
  size = "row",
  align = "start",
  priority = false,
}: {
  src: string | null;
  alt?: string;
  size?: "mini" | "row" | "detail";
  /**
   * Where the plate sits in its flex row. **Both values exist to stop it stretching**, which
   * is the real point of this prop — see the block comment below. `center` is the choice for
   * short rows where a small plate reads better beside centred text; `start` is the default
   * because it is the one that is always safe.
   */
  align?: "start" | "center";
  /**
   * Set on a detail page's poster. It is the largest thing above the fold, so it is the
   * LCP element — leaving it lazy makes the browser discover it late and pop it in after
   * the text has already painted.
   */
  priority?: boolean;
}) {
  const width = size === "detail" ? "w-40 sm:w-52" : size === "mini" ? "w-11" : "w-20";
  const sizes = size === "detail" ? "208px" : size === "mini" ? "44px" : "80px";

  /*
   * `aspect-[2/3]` is not self-enforcing inside a flex row.
   *
   * Flex items stretch to the row's height by default, and a stretched height is a
   * *definite* height — which makes the browser drop `aspect-ratio` entirely. On a person
   * page that meant the poster's height was set by the length of the biography: Samuel L.
   * Jackson's rendered 208×679, a ratio of 0.307 against the 0.667 it asks for, with
   * `object-cover` then slicing the sides off to fill it.
   *
   * Detail pages showed it first, but every row layout in the app had the same latent
   * defect and was saved only by its posters happening to be taller than their text —
   * injecting a long synopsis into a film page stretched it from 312px to 637px. So the
   * guard lives here, on the component, rather than on the four parents that need it today
   * and the fifth that would be written without it.
   */
  const alignment = align === "center" ? "self-center" : "self-start";

  return (
    <div
      className={`border-rule bg-paper-sunk relative aspect-[2/3] ${width} ${alignment} shrink-0 overflow-hidden border`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
