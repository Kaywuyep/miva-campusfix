// The codespireFix brand artwork (files live in /public/brand).
// variant: "full" = gear + CODESPIREFIX wordmark, "mark" = gear only
// tone:    "dark" for navy surfaces (white lettering), "light" for white surfaces (navy lettering)
export default function Logo({
  variant = "mark",
  tone = "dark",
  size = 32,
  className = "",
}) {
  const full = variant === "full";
  return (
    <img
      src={`/brand/${full ? "logo" : "mark"}-${tone}.png`}
      alt={full ? "codespireFix — since 2026" : ""}
      aria-hidden={full ? undefined : "true"}
      className={`logo ${className}`.trim()}
      style={full ? { width: size } : { height: size }}
    />
  );
}
