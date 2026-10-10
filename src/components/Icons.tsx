type IconProps = React.SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconSun = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconMoon = (p: IconProps) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></Svg>;
export const IconMonitor = (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
export const IconCopy = (p: IconProps) => <Svg width="14" height="14" {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const IconCheck = (p: IconProps) => <Svg width="14" height="14" {...p}><path d="m5 12 5 5L20 7" /></Svg>;
export const IconArrowRight = (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconArrowLeft = (p: IconProps) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IconMenu = (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const IconClose = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconClock = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconAlert = (p: IconProps) => <Svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></Svg>;
export const IconChat = (p: IconProps) => <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></Svg>;
export const IconBook = (p: IconProps) => <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></Svg>;
export const IconBolt = (p: IconProps) => <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>;
export const IconBriefcase = (p: IconProps) => <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></Svg>;
export const IconLink = (p: IconProps) => <Svg width="15" height="15" {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></Svg>;
export const IconHistory = (p: IconProps) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Svg>;

/** Знак проекта: фигурные скобки JSX вокруг орбиты — отсылка к React, но не копия логотипа. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M10 6c-3 0-4 1.5-4 4v3c0 1.5-1 3-3 3 2 0 3 1.5 3 3v3c0 2.5 1 4 4 4" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 6c3 0 4 1.5 4 4v3c0 1.5 1 3 3 3-2 0-3 1.5-3 3v3c0 2.5-1 4-4 4" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="16" cy="16" rx="6.5" ry="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" transform="rotate(-30 16 16)" />
      <circle cx="16" cy="16" r="1.8" fill="var(--accent)" />
    </svg>
  );
}
