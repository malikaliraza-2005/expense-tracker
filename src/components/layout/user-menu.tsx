'use client';

import Link from 'next/link';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';

import { signOut } from '@/actions/auth';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/constants/routes';

/**
 * Account menu — an avatar trigger opening a glass dropdown with the profile /
 * settings links, the theme toggle, and logout. Shared by the mobile top bar
 * and the desktop nav so the account surface is identical everywhere.
 */
export function UserMenu({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-none ring-offset-2 ring-offset-background transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar
          name={name}
          src={avatarUrl}
          className="h-10 w-10 ring-primary/40 sm:h-9 sm:w-9"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <Avatar name={name} src={avatarUrl} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {name || 'Your account'}
            </p>
            <p className="text-xs font-normal text-muted-foreground">
              Manage account
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.profile}>
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ROUTES.settings}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button
            type="submit"
            className="relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm text-expense outline-none transition-colors focus:bg-expense/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
