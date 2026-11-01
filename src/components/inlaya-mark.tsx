// Keystone mark: three tiles in the current text color, plus the accent tile
// (override with `[--inlaya-accent:<color>]` when sitting on an orange surface).
export function InlayaMark({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
    >
      <polygon
        points="50,5 71,26 50,47 29,26"
        style={{ fill: "var(--inlaya-accent, #f04f2f)" }}
      />
      <polygon points="74,29 95,50 74,71 53,50" fill="currentColor" />
      <polygon points="50,53 71,74 50,95 29,74" fill="currentColor" />
      <polygon points="26,29 47,50 26,71 5,50" fill="currentColor" />
    </svg>
  );
}
