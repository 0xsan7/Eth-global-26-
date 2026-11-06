"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "City" },
  { href: "/briefs", label: "My briefs" },
  { href: "/opportunities", label: "Opportunities" },
];

export default function NavLinks() {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label="Primary" className="primary-nav">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
