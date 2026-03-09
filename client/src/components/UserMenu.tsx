import { useState, useRef, useEffect } from "react";
import { User, LogOut, ChevronDown, BarChart3 } from "lucide-react";
import type { AuthUser } from "../hooks/useAuth";

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onDashboard: () => void;
}

export function UserMenu({ user, onLogout, onDashboard }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
        <div className="user-avatar">
          <User size={14} />
        </div>
        <span className="user-email">{user.email}</span>
        <ChevronDown size={14} className={`user-chevron ${open ? "open" : ""}`} />
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-email">{user.email}</div>
          <button className="user-dropdown-item" onClick={() => { onDashboard(); setOpen(false); }}>
            <BarChart3 size={14} />
            Dashboard
          </button>
          <button className="user-dropdown-item" onClick={() => { onLogout(); setOpen(false); }}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
