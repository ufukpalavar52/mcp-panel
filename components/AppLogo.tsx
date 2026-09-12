/**
 * The panel's mark: one hub reaching three machines.
 *
 * The same drawing as `app/icon.svg`, and it has to stay the same drawing — a browser tab
 * and a sidebar showing two different logos is how somebody ends up unsure whether they
 * are looking at the right application.
 *
 * Not an `<img>` of that file. The tile changes colour between the two places it appears,
 * and the mark inherits the text colour around it; a raster or an external SVG can do
 * neither.
 */
export default function AppLogo({
  size = 32,
  tone = "brand",
}: {
  size?: number;
  /**
   * `brand` — an orange tile on a light surface, which is the sidebar.
   *
   * `inverse` — a translucent tile on the sign-in page's orange gradient, where an orange
   * one would disappear into the background it is drawn on.
   */
  tone?: "brand" | "inverse";
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      focusable="false"
      className="flex-shrink-0"
    >
      <rect
        width="32"
        height="32"
        rx="7"
        fill={tone === "brand" ? "var(--brand)" : "rgba(255,255,255,0.25)"}
      />

      {/* The hub sits below the middle. Three arms around a centre are never square with
          their own bounding box — two are low and one is high — so a mark centred on its
          hub reads as sitting too high in the tile. */}
      <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 17.9 16 10.3" />
        <path d="M16 17.9 22.6 21.7" />
        <path d="M16 17.9 9.4 21.7" />
      </g>
      <g fill="#fff">
        <circle cx="16" cy="17.9" r="3.2" />
        <circle cx="16" cy="10.3" r="2.4" />
        <circle cx="22.6" cy="21.7" r="2.4" />
        <circle cx="9.4" cy="21.7" r="2.4" />
      </g>
    </svg>
  );
}
