import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = { sm: 40, md: 56, lg: 80 } as const;

type LogoSize = keyof typeof SIZES;

interface LogoProps {
  size?: LogoSize;
  className?: string;
  /** When set, wraps the image in a link (omit on login). */
  href?: string | null;
  priority?: boolean;
}

export function Logo({ size = "sm", className, href = "/dashboard", priority }: LogoProps) {
  const px = SIZES[size];
  const image = (
    <Image
      src="/logo.png"
      alt="AgentGuard"
      width={px}
      height={px}
      priority={priority ?? size !== "sm"}
      className={cn("object-contain", className)}
    />
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 rounded-lg overflow-hidden hover:opacity-90 transition-opacity">
        {image}
      </Link>
    );
  }

  return <span className="shrink-0 inline-block">{image}</span>;
}
