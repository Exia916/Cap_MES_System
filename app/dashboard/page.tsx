import WelcomeCard from "./_components/WelcomeCard";
import DashboardMetrics from "./_components/DashboardMetrics";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <WelcomeCard />
      <DashboardMetrics />
    </div>
  );
}
