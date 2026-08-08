import Image from "next/image";

/**
 * A poster or profile image, treated as a plate in a book: fixed, ruled, and captioned by
 * the text beside it — rather than as a tile in a grid. See decisions.md #11.
 */
export function Plate({
  src,
  alt = "",
  size = "row",
  priority = false,
}: {
  src: string | null;
  alt?: string;
  size?: "mini" | "row" | "detail";
  /**
   * Set on a detail page's poster. It is the largest thing above the fold, so it is the
   * LCP element — leaving it lazy makes the browser discover it late and pop it in after
   * the text has already painted.
   */
  priority?: boolean;
}) {
  const width = size === "detail" ? "w-40 sm:w-52" : size === "mini" ? "w-11" : "w-20";
  const sizes = size === "detail" ? "208px" : size === "mini" ? "44px" : "80px";

  return (
    <div
      className={`border-rule bg-paper-sunk relative aspect-[2/3] ${width} shrink-0 overflow-hidden border`}
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
