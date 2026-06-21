/**
 * Animated Marbled-Ink wave mesh. Two layers: a primary mesh and a
 * blurred parallax layer. Both freeze under prefers-reduced-motion
 * (handled in globals.css — .wave-animated has no animation in reduce).
 */
export function WaveBackground({ intense = false }: { intense?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 wave-animated"
        style={{ background: 'var(--wave-mesh)' }}
      />
      <div
        className="absolute inset-0 wave-animated"
        style={{
          background: 'var(--wave-mesh)',
          filter: 'blur(60px)',
          opacity: intense ? 0.7 : 0.45,
          animationDelay: '-7s',
          animationDuration: '20s',
        }}
      />
      {/* Vignette to keep text legible (WCAG contrast over the mesh) */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 90% 70% at 50% 40%, transparent 0%, rgba(7,6,13,0.6) 100%)' }}
      />
    </div>
  );
}
