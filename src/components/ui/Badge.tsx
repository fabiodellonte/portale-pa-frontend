import { PropsWithChildren } from 'react';

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'warning' }>) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
