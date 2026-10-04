import { PackageSearch } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 py-10">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2 font-display font-bold text-foreground">
          <PackageSearch className="h-4 w-4 text-primary" />
          Forge Supply Co.
        </div>
        <p>Wholesale accounts only · © {new Date().getFullYear()} Forge Supply Co.</p>
      </div>
    </footer>
  );
}
