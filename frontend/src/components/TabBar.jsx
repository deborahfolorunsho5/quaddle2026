import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  CalendarIcon,
  HomeIcon,
  PersonIcon,
  PlusIcon,
  SearchIcon,
} from "./icons";

export default function TabBar() {
  const { user } = useAuth();

  // Guests get the same tabs. Post, Bookings, and Profile are protected
  // routes, which send a guest to log in and then back to the tab.
  const tabs = [
    { to: "/", label: "Browse", icon: HomeIcon, end: true },
    { to: "/search", label: "Search", icon: SearchIcon },
    { to: "/listings/new", label: "Post", icon: PlusIcon },
    { to: "/bookings", label: "Bookings", icon: CalendarIcon },
    {
      // A guest has no id to link to yet; /me resolves it after login.
      to: user ? `/users/${user.id}` : "/me",
      label: "Profile",
      icon: PersonIcon,
    },
  ];

  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {tabs.map(({ to, label, icon: TabIcon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className="tab"
            aria-label={label}
            title={label}
          >
            <TabIcon />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
