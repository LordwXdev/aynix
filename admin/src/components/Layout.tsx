import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useRealtime } from "../realtime/socket";
import { Icons } from "./Icons";

const NAV = [
  { to: "/", label: "Dashboard", icon: Icons.dashboard, end: true },
  { to: "/live", label: "Live map", icon: Icons.live },
  { to: "/orders", label: "Orders", icon: Icons.orders },
  { to: "/deliveries", label: "Deliveries", icon: Icons.deliveries },
  { to: "/stores", label: "Stores", icon: Icons.stores },
  { to: "/drivers", label: "Drivers", icon: Icons.drivers },
  { to: "/users", label: "Users", icon: Icons.users },
  { to: "/categories", label: "Categories", icon: Icons.categories },
];

type Theme = "system" | "light" | "dark";

const readTheme = (): Theme => {
  try {
    return (localStorage.getItem("aynix.admin.theme") as Theme) ?? "system";
  } catch {
    return "system";
  }
};

export const Layout = () => {
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const location = useLocation();

  // close the mobile menu after moving to another page
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("aynix.admin.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">A</div>
          Aynix Admin
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small muted">
            <span className={`live-dot${connected ? " on" : ""}`} />
            {connected ? "Live updates on" : "Live updates off"}
          </div>
          <select
            aria-label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <div className="small">
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <div className="muted">{user?.phone}</div>
          </div>
          <button className="btn" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <button className="btn menu-btn" onClick={() => setOpen(!open)} style={{ marginBottom: 12 }}>
          <Icons.menu /> Menu
        </button>
        <Outlet />
      </main>
    </div>
  );
};
