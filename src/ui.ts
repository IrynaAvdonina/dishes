import type { CSSProperties } from 'react'
import type { Role } from './types'

/** Кольори й форми ролей (пілюлі в каталозі та у формі). */
export const ROLES: { k: Role; bg: string; dot: string; r: string }[] = [
  { k: 'side', bg: '#FDF4CF', dot: '#F6D96B', r: '22px 4px 22px 22px' },
  { k: 'protein', bg: '#FDE6D8', dot: '#F5A97F', r: '4px 22px 22px 22px' },
  { k: 'full', bg: '#E5EBFC', dot: '#9FB1EE', r: '22px 22px 22px 4px' }
]

const PILL_R = ['22px 22px 4px 22px', '22px 4px 22px 22px', '4px 22px 22px 22px', '22px 22px 22px 4px']
export const pillStyle = (on: boolean, i: number): CSSProperties => ({
  borderRadius: PILL_R[i % 4], border: on ? '0' : '1.5px dashed #B7C3EE', background: on ? '#3149B8' : '#fff', color: on ? '#fff' : '#3149B8'
})

/** Якщо сторінку відкрито напряму (без історії в застосунку) — повертаємось у каталог. */
export const canGoBack = (steps = 1) => (window.history.state?.idx ?? 0) >= steps
