import DailyProductionForm from "../DailyProductionForm";

export default async function EditDailyProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1>Edit Daily Production Entry</h1>
      <DailyProductionForm mode="edit" id={id} />
    </div>
  );
}
