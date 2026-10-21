import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function PictureAvatar({ name, url, table = false, className }: {
  name: string; url?: string | null; table?: boolean; className?: string;
}) {
  const initials = name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "·";
  return <Avatar key={url ?? "initials"} className={cn(table && "rounded-lg", className)}>
    {url && <AvatarImage src={url} alt="" className="object-cover" />}
    <AvatarFallback className={cn(table && "rounded-lg")}>{initials}</AvatarFallback>
  </Avatar>;
}
