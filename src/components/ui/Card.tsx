import { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{ className?: string; as?: 'section' | 'article' | 'header' | 'div'; testId?: string }>;

export function Card({ className = '', as = 'section', testId, children }: CardProps) {
  const Comp = as;
  return <Comp className={`ui-card ${className}`.trim()} data-testid={testId}>{children}</Comp>;
}
