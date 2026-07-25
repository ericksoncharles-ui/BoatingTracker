// Tide curve drawn as inline SVG — no charting dependency, matching the
// hand-rolled SVG used elsewhere in the app.

const WIDTH = 320
const HEIGHT = 96
const PAD_X = 6
const PAD_TOP = 10
const PAD_BOTTOM = 18

export default function TideChart({ curve, extremes = [], now = new Date() }) {
  if (!curve || curve.length < 2) return null

  const heights = curve.map((p) => p.heightFt)
  const minHeight = Math.min(...heights)
  const maxHeight = Math.max(...heights)
  const span = maxHeight - minHeight || 1

  const firstMs = curve[0].at.getTime()
  const lastMs = curve[curve.length - 1].at.getTime()
  const timeSpan = lastMs - firstMs || 1

  const x = (at) => PAD_X + ((at.getTime() - firstMs) / timeSpan) * (WIDTH - PAD_X * 2)
  const y = (heightFt) =>
    PAD_TOP + (1 - (heightFt - minHeight) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

  const line = curve.map((p) => `${x(p.at).toFixed(1)},${y(p.heightFt).toFixed(1)}`).join(' ')
  const area = `${PAD_X},${HEIGHT - PAD_BOTTOM} ${line} ${WIDTH - PAD_X},${HEIGHT - PAD_BOTTOM}`

  const nowMs = now.getTime()
  const nowInRange = nowMs >= firstMs && nowMs <= lastMs
  const nowX = nowInRange ? x(now) : null

  const visibleExtremes = extremes.filter(
    (e) => e.at.getTime() >= firstMs && e.at.getTime() <= lastMs,
  )

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="tide-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="tide-chart-svg"
        role="img"
        aria-label={`Tide curve from ${formatTime(curve[0].at)} to ${formatTime(curve[curve.length - 1].at)}`}
      >
        <defs>
          <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A9FD8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4A9FD8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <polygon points={area} fill="url(#tideFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#6FB8E8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {visibleExtremes.map((e) => (
          <g key={`${e.kind}-${e.at.getTime()}`}>
            <circle
              cx={x(e.at)}
              cy={y(e.heightFt)}
              r="3"
              fill={e.kind === 'high' ? '#8FD3F4' : '#2B6CB0'}
              stroke="#0F1B33"
              strokeWidth="1"
            />
            <text
              x={x(e.at)}
              y={e.kind === 'high' ? y(e.heightFt) - 5 : y(e.heightFt) + 11}
              textAnchor="middle"
              className="tide-chart-label"
            >
              {e.heightFt.toFixed(1)}
            </text>
          </g>
        ))}

        {nowX != null && (
          <>
            <line
              x1={nowX}
              y1={PAD_TOP - 4}
              x2={nowX}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#F6AD55"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <text x={nowX} y={HEIGHT - 5} textAnchor="middle" className="tide-chart-now">
              now
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
