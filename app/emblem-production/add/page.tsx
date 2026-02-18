import EmblemProductionForm from "../EmblemProductionForm";

export default function EmblemAddPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Add Emblem Production</h1>
      <EmblemProductionForm mode="add" />
    </div>
  );
}
