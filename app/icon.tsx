import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '107px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 192,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: '-5px',
          }}
        >
          PH
        </span>
      </div>
    ),
    { ...size }
  )
}
