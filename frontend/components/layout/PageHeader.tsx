import { CoolIcon, type CoolIconName, type IconTone } from "@/components/icons/CoolIcon";

interface PageHeaderProps {
  icon: CoolIconName;
  tone?: IconTone;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function PageHeader({
  icon,
  tone = "primary",
  title,
  subtitle,
  children,
  trailing,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-1 gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "color-mix(in srgb, var(--ag-cyan) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ag-cyan) 35%, transparent)",
            boxShadow: "var(--ag-glow-cyan)",
          }}
        >
          <CoolIcon name={icon} tone={tone} size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="ag-text-section leading-none">{title}</h1>
          {subtitle && <p className="ag-text-meta mt-1">{subtitle}</p>}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}
