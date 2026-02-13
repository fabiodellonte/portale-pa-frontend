import { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>;

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return <button {...props} className={`ui-button ui-button--${variant} ${className}`.trim()}>{children}</button>;
}
