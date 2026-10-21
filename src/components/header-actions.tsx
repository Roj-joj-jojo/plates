"use client";

import Link from "next/link";
import { useCurrentProfile } from "@/components/current-profile";
import { PictureAvatar } from "@/components/picture-avatar";
import { NotificationIndicators } from "@/components/notification-indicators";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/app/account/sign-out-button";

export function HeaderActions() {
  const profile = useCurrentProfile();
  return <div className="flex shrink-0 items-center gap-1">
    <NotificationIndicators />
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" aria-label="Open account menu"
        className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-card/10">
        <PictureAvatar name={profile?.name ?? "You"} url={profile?.url} className="size-8 sm:size-9" />
      </button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="max-w-64 break-words">{profile?.name ?? "Your account"}</DropdownMenuLabel>
        {profile?.username && <DropdownMenuLabel className="max-w-64 break-all text-sm font-normal text-muted-foreground">@{profile.username}</DropdownMenuLabel>}
        <DropdownMenuItem asChild><Link href={profile ? "/people/" + profile.id : "/account"}>Your profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/account">Privacy and settings</Link></DropdownMenuItem>
        <SignOutButton menuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
