const YELLOW = '#FFCD32'

interface Cfg {
  label: string
  color: string
  bg: string
  borderColor: string
  borderStyle?: 'solid' | 'dashed'
  allSides?: boolean
  dot?: boolean
  strikethrough?: boolean
}

const CONFIGS: Record<string, Cfg> = {
  active:      { label: 'ACTIVE',      color: YELLOW,    bg: 'rgba(255,205,50,0.06)', borderColor: YELLOW,    dot: true },
  suspended:   { label: 'SUSPENDED',   color: '#D97706', bg: 'rgba(217,119,6,0.06)', borderColor: '#D97706',  dot: true },
  expired:     { label: 'EXPIRED',     color: '#4B5563', bg: 'transparent',           borderColor: '#2A2A2A',  dot: true },
  provisional: { label: 'PROVISIONAL', color: YELLOW,    bg: 'rgba(255,205,50,0.04)', borderColor: YELLOW,    borderStyle: 'dashed', allSides: true },
  confirmed:   { label: 'CONFIRMED',   color: '#4ADE80', bg: 'rgba(74,222,128,0.05)', borderColor: '#166534', allSides: true },
  reversed:    { label: 'REVERSED',    color: '#4B5563', bg: 'transparent',           borderColor: '#2A2A2A', allSides: true, strikethrough: true },
  pending:     { label: 'PENDING',     color: YELLOW,    bg: 'rgba(255,205,50,0.04)', borderColor: YELLOW,    borderStyle: 'dashed', allSides: true },
  dead_letter: { label: 'DEAD LETTER', color: '#EF4444', bg: 'rgba(239,68,68,0.05)', borderColor: '#7F1D1D',  dot: true },
  delivered:   { label: 'DELIVERED',   color: '#4ADE80', bg: 'rgba(74,222,128,0.05)', borderColor: '#166534', dot: true },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg: Cfg = CONFIGS[status] ?? {
    label: status.toUpperCase(),
    color: '#4B5563',
    bg: 'transparent',
    borderColor: '#2A2A2A',
    dot: true,
  }

  const borderStyles = cfg.allSides
    ? { border: `1px ${cfg.borderStyle ?? 'solid'} ${cfg.borderColor}` }
    : { borderLeft: `2px solid ${cfg.borderColor}` }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        background: cfg.bg,
        color: cfg.color,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.1em',
        textDecoration: cfg.strikethrough ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
        ...borderStyles,
      }}
    >
      {cfg.dot && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: cfg.color,
            flexShrink: 0,
          }}
        />
      )}
      {cfg.label}
    </span>
  )
}
