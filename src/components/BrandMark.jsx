export default function BrandMark({ size = 56 }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon-192.png`}
      width={size}
      height={size}
      alt="NexusHD"
      draggable="false"
      style={{
        display: 'block',
        flex: '0 0 auto',
        borderRadius: Math.round(size * 0.24),
        objectFit: 'cover',
      }}
    />
  );
}
