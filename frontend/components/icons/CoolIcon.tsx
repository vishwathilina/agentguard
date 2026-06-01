import { cn } from "@/lib/utils";

export type CoolIconName =
  | "bell"
  | "chart-line"
  | "chat"
  | "chevron-down"
  | "cloud"
  | "code"
  | "data"
  | "folder"
  | "lock"
  | "log-out"
  | "play"
  | "plus"
  | "search"
  | "settings"
  | "shield"
  | "shield-check"
  | "shield-warning"
  | "trash"
  | "trending-down"
  | "trending-up"
  | "user"
  | "warning"
  | "close";

export type IconTone =
  | "default"
  | "muted"
  | "primary"
  | "safe"
  | "danger"
  | "warning"
  | "neutral"
  | "coral"
  | "lime";

const ICON_CLASS: Record<CoolIconName, string> = {
  bell: "ci-Bell",
  "chart-line": "ci-Chart_Line",
  chat: "ci-Chat",
  "chevron-down": "ci-Chevron_Down",
  cloud: "ci-Cloud",
  code: "ci-Code",
  data: "ci-Data",
  folder: "ci-Folder",
  lock: "ci-Lock",
  "log-out": "ci-Log_Out",
  play: "ci-Play",
  plus: "ci-Add_Plus",
  search: "ci-Search_Magnifying_Glass",
  settings: "ci-Settings",
  shield: "ci-Shield",
  "shield-check": "ci-Shield_Check",
  "shield-warning": "ci-Shield_Warning",
  trash: "ci-Trash_Full",
  "trending-down": "ci-Trending_Down",
  "trending-up": "ci-Trending_Up",
  user: "ci-User_01",
  warning: "ci-Warning",
  close: "ci-Close_MD",
};

const TONE_CLASS: Record<IconTone, string> = {
  default: "ci-tone-default",
  muted: "ci-tone-muted",
  primary: "ci-tone-primary",
  safe: "ci-tone-safe",
  danger: "ci-tone-danger",
  warning: "ci-tone-warning",
  neutral: "ci-tone-neutral",
  coral: "ci-tone-coral",
  lime: "ci-tone-lime",
};

interface CoolIconProps {
  name: CoolIconName;
  tone?: IconTone;
  size?: number;
  className?: string;
  title?: string;
}

export function CoolIcon({
  name,
  tone = "default",
  size = 16,
  className,
  title,
}: CoolIconProps) {
  return (
    <i
      className={cn("ci inline-block shrink-0 not-italic", ICON_CLASS[name], TONE_CLASS[tone], className)}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden={title ? undefined : true}
      title={title}
    />
  );
}
