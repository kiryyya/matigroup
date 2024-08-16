import {
  Home,
  type LucideIcon,
  Settings,
  UnlockKeyhole,
  UserCog,
  ListFilter,
} from "lucide-react";

export const siteConfig = {
  name: "Fusion Email",
  shortName: "Fusion Email",
  author: "Fusion Email",
  description: "Quickly filter emails from galleries of your interest.",
};

type SidebarButton = {
  href: string;
  icon: LucideIcon;
  text: string;
  subtext?: string;
  disabled?: boolean;
  external?: boolean;
};

type SidebarSection = {
  title: string;
  subtext?: string;
  buttons: SidebarButton[];
};

export const sidebarSections: SidebarSection[] = [
  {
    title: "Dashboard",
    buttons: [{ href: "/", icon: Home, text: "Home" }],
  },
  {
    title: "Settings",
    buttons: [
      {
        href: "/listed-galleries/",
        icon: ListFilter,
        text: "Listed Galleries",
      },
      { href: "/settings/", icon: Settings, text: "General", disabled: true },
      { href: "/settings/users", icon: UserCog, text: "Users", disabled: true },
      {
        href: "/settings/permissions",
        icon: UnlockKeyhole,
        text: "Permissions",
        disabled: true,
      },
    ],
  },
];
