// Square-ish rounded image (champion or profile icon) with a neutral placeholder when the URL
// is unknown, so rows never collapse.
export function Avatar({
  src,
  alt,
  size,
  radius,
  className,
  style,
}: {
  src: string | undefined;
  alt: string;
  size: number;
  radius: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const box = { width: size, height: size, borderRadius: radius, ...style };
  if (!src) return <span className={`zr-icon ${className ?? ""}`} style={{ display: "block", ...box }} aria-hidden />;
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" className={`zr-icon ${className ?? ""}`} style={box} />;
}
