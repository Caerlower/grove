import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="app-shell">
        <AppNav />
        <div className="app-body">{children}</div>
      </div>
    </Providers>
  );
}
