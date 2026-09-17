import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useCartCount } from "../cart/cartStore";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
  }`;

export function AppLayout({ children }: { children: ReactNode }) {
  const cartCount = useCartCount();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">Neu.Tail</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" className={navLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/chat" className={navLinkClass}>
              Chat
            </NavLink>
            <NavLink to="/try-on" className={navLinkClass}>
              Try-On
            </NavLink>
            <NavLink to="/cart" className={navLinkClass}>
              Cart{cartCount > 0 ? ` (${cartCount})` : ""}
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              Profile
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
