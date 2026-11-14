"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Settings, ShieldQuestion, UserRound } from "lucide-react";
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
import { BrandLockup } from "@/components/shared/brand";
import { MockDataBadge } from "@/components/shared/demo-notices";
import { MobileSidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/auth/auth-provider";
import { activeNavItem } from "@/lib/navigation";
import { initials } from "@/lib/utils/format";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isDemoSession, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const current = activeNavItem(pathname);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.replace("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>

          <div className="lg:hidden">
            <BrandLockup tone="light" subtitle={false} />
          </div>

          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Workspace
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="truncate text-sm font-medium">
              {current?.label ?? "SHEPHERD"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <MockDataBadge className="hidden sm:inline-flex" />
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="hidden text-muted-foreground sm:inline-flex"
              aria-label="Privacy and AI disclosures"
            >
              <Link href="/settings#privacy">
                <ShieldQuestion className="size-4" />
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8 border border-border">
                    <AvatarFallback>{initials(user?.displayName)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case tracking-normal">
                  <span className="block text-xs font-semibold text-foreground">
                    {user?.displayName ?? "SHEPHERD user"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                    {isDemoSession ? "Local demo session" : user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <UserRound />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => void handleSignOut()}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
