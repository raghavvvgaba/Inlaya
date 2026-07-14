export function InlayaMark({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center bg-[#f04f2f] ${className}`}
      style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
    >
      <span
        className="h-[42%] w-[42%] bg-[#171713]"
        style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
      />
    </span>
  );
}
