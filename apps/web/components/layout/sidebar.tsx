"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Plus,
  Settings as SettingsIcon,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandLockup } from "@/components/shared/brand";
import { useAuth } from "@/lib/auth/auth-provider";
import { NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-slim">
      <Button
        asChild
        className="w-full justify-start bg-[#dcebe4] text-[#0d3b33] hover:bg-[#cfe4da]"
        size="sm"
      >
        <Link href="/incidents/new" onClick={onNavigate}>
          <Plus className="size-4" />
          New incident
        </Link>
      </Button>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-muted/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-active text-white"
                    : "text-sidebar-muted hover:bg-white/[0.055] hover:text-white",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[#9ccbb8]"
                  />
                ) : null}
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-[#b9dccd]" : "text-sidebar-muted/80",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarFooter() {
  const { user, isDemoSession, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.replace("/login");
  };

  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-sidebar-border bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-sidebar-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        <p>
          SHEPHERD is a documentation tool, not an emergency service. Call local
          emergency services if you are in immediate danger.
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.055] focus-visible:ring-2 focus-visible:ring-[#9ccbb8]/50"
          >
            <Avatar className="size-8 border border-white/10">
              <AvatarFallback className="bg-[#23352f] text-[#cfe4da]">
                {initials(user?.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-white">
                {user?.displayName ?? "SHEPHERD user"}
              </span>
              <span className="block truncate text-[10px] text-sidebar-muted">
                {isDemoSession ? "Local demo session" : user?.email}
              </span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-sidebar-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserRound />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[264px] lg:shrink-0 lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar">
      <div className="sidebar-grid border-b border-sidebar-border px-5 py-5">
        <Link href="/dashboard" className="rounded-md focus-visible:ring-2 focus-visible:ring-[#9ccbb8]/50">
          <BrandLockup tone="dark" />
        </Link>
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          SHEPHERD application navigation
        </SheetDescription>
        <div className="sidebar-grid border-b border-sidebar-border px-5 py-5">
          <BrandLockup tone="dark" />
        </div>
        <SidebarNav onNavigate={() => onOpenChange(false)} />
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
