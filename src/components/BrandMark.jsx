export default function BrandMark({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="nx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="1" stopColor="#5b0fd6" />
        </linearGradient>
      </defs>
      <path d="M12 52V12h12l16 26V12h12v40H40L24 26v26z" fill="url(#nx-g)" />
    </svg>
  );
}
