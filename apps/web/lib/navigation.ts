import {
  FileSignature,
  FileText,
  FolderLock,
  LayoutDashboard,
  Network,
  ScanSearch,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        description: "Workspace overview and recent activity",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Document",
    items: [
      {
        href: "/incidents",
        label: "Incidents",
        description: "Chronological incident records",
        icon: FileText,
      },
      {
        href: "/evidence",
        label: "EvidenceVault",
        description: "Private evidence metadata and hashes",
        icon: FolderLock,
      },
      {
        href: "/threatlens",
        label: "ThreatLens",
        description: "Explainable AI-assisted analysis",
        icon: ScanSearch,
      },
      {
        href: "/patterns",
        label: "PatternGraph",
        description: "Explainable incident relationships",
        icon: Network,
      },
    ],
  },
  {
    label: "Respond",
    items: [
      {
        href: "/safecircle",
        label: "SafeCircle",
        description: "Trusted contacts and check-ins",
        icon: Users,
      },
      {
        href: "/justicebridge",
        label: "JusticeBridge",
        description: "Structured incident reports",
        icon: FileSignature,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/settings",
        label: "Settings",
        description: "Profile, privacy and sessions",
        icon: Settings,
      },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function activeNavItem(pathname: string | null): NavItem | undefined {
  if (!pathname) return undefined;
  return ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
