import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, Building2, GraduationCap, ClipboardCheck, HelpCircle, Menu, MessagesSquare } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resetDemo } from "@/lib/ipp-store";
import { ChatWidget } from "@/components/ChatWidget";

const NAV = [
  { to: "/student", label: "Student", icon: GraduationCap },
  { to: "/employer", label: "Employer HR", icon: Briefcase },
  { to: "/admin", label: "University Administrator", icon: Building2 },
  { to: "/faculty", label: "Faculty Reviewer", icon: ClipboardCheck },
  { to: "/desk", label: "Internship Desk", icon: MessagesSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const rolesButtonRef = useRef<HTMLButtonElement>(null);

  // Phone-width Roles menu: move focus in, trap Tab, close on Esc, restore focus to the Roles button.
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const focusables = () => Array.from(menu?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || !menu?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !menu?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); rolesButtonRef.current?.focus({ preventScroll: true }); };
  }, [open]);

  const onReset = () => {
    if (window.confirm("Reset demo? All synthetic records in this browser will be replaced with the original seed data.")) {
      resetDemo();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-banner px-4 py-2 text-center text-sm text-banner-foreground">
        <span>Demo workspace · Role switching is simulated. Synthetic data is saved only in this browser.</span>
        <button onClick={onReset} className="font-semibold underline underline-offset-2">
          Reset demo
        </button>
      </div>
      <div className="flex flex-1">
        <aside
          id="roles-menu"
          ref={menuRef}
          aria-label="Roles"
          {...(open ? { role: "dialog", "aria-modal": true } : {})}
          className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-20 w-64 border-r border-border bg-card p-4 md:static md:block`}
        >
          <div className="mb-7 flex items-center gap-3 px-2">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime font-display text-sm font-bold text-lime-foreground"
            >
              IPP
            </span>
            <div>
              <div className="font-display text-lg font-bold leading-tight text-foreground">Internship Practicum</div>
              <div className="text-xs text-muted-foreground">BUS 2010 co-op platform</div>
            </div>
          </div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Role (simulated)
          </p>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-lime font-semibold text-lime-foreground" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <p className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Help</p>
          <Link
            to="/faq"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              path === "/faq" ? "bg-lime font-semibold text-lime-foreground" : "text-foreground hover:bg-muted"
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            FAQ &amp; chatbot
          </Link>
          <p className="mt-8 px-2 text-xs text-muted-foreground">
            Records are stored in this browser's local storage and are not shared across devices.
          </p>
        </aside>
        {open && <div className="fixed inset-0 z-10 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-24">
          <button
            ref={rolesButtonRef}
            aria-expanded={open}
            aria-controls="roles-menu"
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" /> Roles
          </button>
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-base text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="mb-3 font-display text-lg font-bold text-foreground">{title}</h2>
      <div className="text-sm text-card-foreground">{children}</div>
    </section>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-status px-2.5 py-0.5 text-xs font-medium text-status-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-status-foreground" />
      {children}
    </span>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">{children}</p>;
}
