import { HomeClient } from "@/components/HomeClient";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export default function HomePage() {
  return (
    <AppErrorBoundary>
      <HomeClient />
    </AppErrorBoundary>
  );
}
