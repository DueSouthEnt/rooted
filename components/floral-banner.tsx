import Image from "next/image";

const tiles = [0, 1, 2, 3, 4];

/** A quiet row of flowers along the top of a page. The drawing repeats so the soil line runs the full width. */
export function FloralBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`floral-banner ${className}`} aria-hidden>
      {tiles.map((tile) => (
        <Image
          key={tile}
          src="/floral-banner.webp"
          alt=""
          width={1800}
          height={416}
          priority={tile === 0}
          sizes="32rem"
          style={{ height: "100%", width: "auto", maxWidth: "none" }}
          className="object-cover object-bottom"
        />
      ))}
    </div>
  );
}
