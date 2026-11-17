import type { Role } from './types'
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
export const IcSearch = () => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#3149B8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
export const IcSort = () => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#fff" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>
export const IcFilter = () => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#3149B8" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
export const IcEyeOff = ({ c = '#3149B8' }: { c?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke={c} aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/></svg>
export const IcPlus = ({ c = '#fff', s = 24 }: { c?: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" {...S} stroke={c} strokeWidth={2.4} aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
export const IcCheck = ({ c = '#1F2A5C', s = 16 }: { c?: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" {...S} stroke={c} strokeWidth={3} aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>
export const IcBack = () => <svg width="22" height="22" viewBox="0 0 24 24" {...S} stroke="#3149B8" strokeWidth={2.4} aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
export const IcGrip = () => <svg width="18" height="22" viewBox="0 0 18 22" fill="#8C99CE" aria-hidden="true"><circle cx="5" cy="4" r="2"/><circle cx="13" cy="4" r="2"/><circle cx="5" cy="11" r="2"/><circle cx="13" cy="11" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="13" cy="18" r="2"/></svg>
export const IcOven = () => <svg width="16" height="16" viewBox="0 0 24 24" {...S} stroke="#8A5A00" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><rect x="7" y="12" width="10" height="5" rx="1"/></svg>
export const IcCamera = () => <svg width="18" height="18" viewBox="0 0 24 24" {...S} stroke="#3149B8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
export const IcSwap = () => <svg width="18" height="18" viewBox="0 0 24 24" {...S} stroke="#3149B8" strokeWidth={2.2} aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3"/></svg>
export const IcClose = ({ c = '#4A5690' }: { c?: string }) => <svg width="18" height="18" viewBox="0 0 24 24" {...S} stroke={c} strokeWidth={2.4} aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
export const IcTrash = () => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#B4491F" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>
export const IcBackup = () => <svg width="20" height="20" viewBox="0 0 24 24" {...S} stroke="#3149B8" aria-hidden="true"><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4M12 4v11M8 11l4 4 4-4"/></svg>
export const IcPlate = ({ c }: { c: string }) => <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke={c} strokeWidth="1.5" opacity=".55" aria-hidden="true"><circle cx="26" cy="26" r="22"/><circle cx="26" cy="26" r="14"/><path d="M20 24c2-4 10-4 12 0M21 31c3 3 7 3 10 0" strokeLinecap="round"/></svg>

export function RoleGlyph({ role, s = 20 }: { role: Role; s?: number }) {
  if (role === 'side') return <svg width={s} height={s} viewBox="0 0 24 24" fill="#F6D96B" stroke="#8A6B00" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/></svg>
  if (role === 'protein') return <svg width={s} height={s} viewBox="0 0 24 24" fill="#F5A97F" stroke="#9A4A1C" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="#9FB1EE" stroke="#3149B8" strokeWidth="1.8" aria-hidden="true"><path d="M4 20V10a8 8 0 0116 0v10z"/></svg>
}
