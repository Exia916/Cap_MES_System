import LaserProductionForm from "../LaserProductionForm";

export default function LaserAddPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Add Laser Production</h1>
      <LaserProductionForm mode="add" />
    </div>
  );
}
