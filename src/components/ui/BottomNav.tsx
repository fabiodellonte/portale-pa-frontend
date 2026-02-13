import { Button } from './Button';

type Item = { key: string; label: string; onClick: () => void };

export function BottomNav({ items, activeKey }: { items: Item[]; activeKey: string }) {
  return (
    <nav className="bottom-nav" aria-label="Navigazione mobile">
      {items.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant="ghost"
          onClick={item.onClick}
          className={activeKey === item.key ? 'active' : ''}
          aria-current={activeKey === item.key ? 'page' : undefined}
          data-testid={`bottom-nav-${item.key}`}
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
