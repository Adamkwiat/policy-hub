import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#9333ea',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 68,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: '-2px',
          }}
        >
          PH
        </span>
      </div>
    ),
    { ...size }
  )
}
