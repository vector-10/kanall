import { Link } from 'react-router-dom'

interface Props {
  tip: string
  children: React.ReactNode
}

export default function AuthShell({ tip, children }: Props) {
  return (
    <div
      className="bg-[#0D0D0D] text-[#F5F5F5] md:flex"
      style={{ fontFamily: 'var(--font-sans)', minHeight: '100svh' }}
    >

      {/* LEFT PANEL — desktop only */}
      <div className="hidden md:flex relative flex-col w-[52%] shrink-0 overflow-hidden" style={{ minHeight: '100svh' }}>

        {/* Yellow splash from top-left */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 w-full h-full"
          viewBox="0 0 520 900"
          preserveAspectRatio="none"
        >
          <path
            d="M 0,0 L 395,0
               C 352,68 425,148 368,230
               C 311,312 395,382 328,462
               C 261,542 340,622 278,705
               C 218,782 110,810 40,778
               C 12,760 0,720 0,700 Z"
            fill="#FFCD32"
          />
        </svg>

        {/* Panel content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10" style={{ minHeight: '100svh' }}>

          {/* Logo — sits on yellow area, so dark text */}
          <Link to="/" className="inline-block">
            <span style={{ fontFamily: "'Bungee Inline', sans-serif", fontSize: '22px', letterSpacing: '0.06em', color: '#0D0D0D' }}>
              KANALL
            </span>
          </Link>

          {/* Tip — centered vertically, on yellow background */}
          <div className="flex-1 flex items-center pl-6">
            <div style={{ maxWidth: 300 }}>
              <div className="w-8 h-px bg-[#0D0D0D] mb-6 opacity-30" />
              <p className="text-[#0D0D0D] font-medium leading-snug" style={{ fontSize: 'clamp(1.25rem, 2vw, 1.55rem)', letterSpacing: '-0.01em' }}>
                {tip}
              </p>
            </div>
          </div>

          {/* Footer label */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(0,0,0,0.35)' }}>
            BUILT ON NOMBA
          </span>
        </div>
      </div>

      {/* RIGHT PANEL — form */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-6 py-16 md:py-12" style={{ minHeight: '100svh' }}>

        {/* Mobile: yellow splash top-left */}
        <svg
          aria-hidden="true"
          className="md:hidden pointer-events-none absolute top-0 left-0"
          style={{ width: '52%', height: '26vh', zIndex: 0 }}
          viewBox="0 0 210 260"
          preserveAspectRatio="none"
        >
          <path
            d="M 0,0 L 210,0
               C 175,42 225,95 182,152
               C 139,209 170,248 138,260
               L 0,260 Z"
            fill="#FFCD32"
          />
        </svg>

        {/* Mobile: logo over splash */}
        <div className="md:hidden absolute top-5 left-6 z-10">
          <Link to="/">
            <span style={{ fontFamily: "'Bungee Inline', sans-serif", fontSize: '20px', letterSpacing: '0.06em', color: '#0D0D0D' }}>
              KANALL
            </span>
          </Link>
        </div>

        {/* Form content */}
        <div className="relative z-10 w-full" style={{ maxWidth: 360 }}>
          {children}
        </div>
      </div>

    </div>
  )
}
