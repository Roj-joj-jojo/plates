"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCurrentProfile } from "@/components/current-profile";
import { PictureAvatar } from "@/components/picture-avatar";
import { Button } from "@/components/ui/button";

export function FeedCreateAction() {
  const profile = useCurrentProfile();
  return <>
    <div className="mb-5 hidden items-center gap-4 rounded-lg border border-border bg-card p-4 thread:flex">
      <PictureAvatar name={profile?.name ?? "You"} url={profile?.url} className="size-10" />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">What have you been cooking?</p>
      <Button asChild><Link href="/feed/new"><Plus aria-hidden="true" />Add a Plate</Link></Button>
    </div>
    <Button asChild size="icon" className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 size-12 rounded-full shadow-lg [&_svg]:size-6 thread:hidden">
      <Link href="/feed/new" aria-label="Add a Plate" title="Add a Plate"><Plus aria-hidden="true" className="size-6" /></Link>
    </Button>
  </>;
}
