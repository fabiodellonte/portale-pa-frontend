import { PropsWithChildren } from 'react';

export function Chip({ children, active = false }: PropsWithChildren<{ active?: boolean }>) {
  return <span className={`ui-chip ${active ? 'is-active' : ''}`.trim()}>{children}</span>;
}
