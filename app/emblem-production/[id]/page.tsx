import EmblemProductionForm from "../EmblemProductionForm";

export default async function EmblemEditPage(
  props: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  // Support both shapes (Next 15 vs 16 behavior)
  const params = "then" in props.params ? await props.params : props.params;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Edit Emblem Production</h1>
      <EmblemProductionForm mode="edit" id={params.id} />
    </div>
  );
}
