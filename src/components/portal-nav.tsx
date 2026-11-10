"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const active = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="portal-nav" aria-label="Chức năng">
      {links.map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.href === active ? "page" : undefined}>{link.label}</Link>
      ))}
    </nav>
  );
}
