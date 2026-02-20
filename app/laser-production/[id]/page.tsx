import LaserProductionForm from "../LaserProductionForm";

export default async function LaserEditPage(
  props: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  const params = "then" in props.params ? await props.params : props.params;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Edit Laser Production</h1>
      <LaserProductionForm mode="edit" id={params.id} />
    </div>
  );
}
