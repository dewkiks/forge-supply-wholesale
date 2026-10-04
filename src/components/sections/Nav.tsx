import { useState } from 'react';
import { Menu, PackageSearch, X } from 'lucide-react';

const LINKS = [
  { label: 'Catalog', href: '#catalog' },
  { label: 'Wholesale pricing', href: '#pricing' },
  { label: 'Why Forge', href: '#benefits' },
  { label: 'Reviews', href: '#reviews' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 font-display text-lg font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PackageSearch className="h-4.5 w-4.5" />
          </span>
          Forge Supply Co.
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href="#contact" className="text-sm font-semibold text-foreground hover:text-primary">
            Sign in
          </a>
          <a
            href="#contact"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-signature transition hover:brightness-110"
          >
            Request wholesale access
          </a>
        </div>

        <button className="p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">
              {l.label}
            </a>
          ))}
          <a href="#contact" className="mt-2 block rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            Request wholesale access
          </a>
        </div>
      )}
    </header>
  );
}
