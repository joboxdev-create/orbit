import { Orbit } from "lucide-react";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Orbit size={size} className="text-primary" />
      <strong className="font-heading tracking-wide">ORBIT</strong>
    </span>
  );
}
