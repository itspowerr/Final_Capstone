export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return (
    <div
      className="skeleton-line"
      style={{ width, height, borderRadius: 6, ...style }}
    />
  );
}

export function SkeletonCircle({ size = 40, style = {} }) {
  return (
    <div
      className="skeleton-circle"
      style={{ width: size, height: size, borderRadius: '50%', ...style }}
    />
  );
}

export function SkeletonCard({ rows = 3, style = {} }) {
  return (
    <div className="skeleton-card" style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <SkeletonCircle size={44} />
        <div style={{ flex: 1 }}>
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="40%" height={12} style={{ marginTop: 8 }} />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} width={i === rows - 1 ? '75%' : '100%'} height={12} style={{ marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="skeleton-card" style={{ padding: '20px 24px' }}>
      <SkeletonLine width="45%" height={12} />
      <SkeletonLine width="70%" height={28} style={{ marginTop: 12 }} />
      <SkeletonLine width="55%" height={12} style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="skeleton-card" style={{ overflow: 'hidden' }}>
      <div className="skeleton-table-header" style={{ display: 'flex', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${100 / cols}%`} height={12} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, padding: '14px 20px', borderBottom: r < rows - 1 ? '1px solid var(--border)' : 'none' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={`${80 + Math.random() * 20}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonThreadList({ count = 6 }) {
  return (
    <div className="skeleton-card" style={{ padding: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < count - 1 ? '1px solid var(--border)' : 'none' }}>
          <SkeletonCircle size={42} />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="55%" height={14} />
            <SkeletonLine width="80%" height={12} style={{ marginTop: 6 }} />
          </div>
          <SkeletonLine width={36} height={20} style={{ borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChatArea() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: i % 2 === 0 ? 'row' : 'row-reverse' }}>
            {i % 2 !== 0 && <SkeletonCircle size={28} />}
            <SkeletonLine width={120 + Math.random() * 160} height={36} style={{ borderRadius: 16 }} />
            {i % 2 === 0 && <SkeletonCircle size={28} />}
          </div>
        </div>
      ))}
    </div>
  );
}
