import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top left, #86efac 0%, #14b8a6 52%, #0f172a 100%)',
          borderRadius: 120,
        }}
      >
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '10px solid rgba(255,255,255,0.18)',
            color: 'white',
            fontSize: 240,
            fontWeight: 700,
            letterSpacing: '-0.08em',
          }}
        >
          L
        </div>
      </div>
    ),
    size,
  );
}
