import DailyProductionForm from "../DailyProductionForm";

export default function EditDailyProductionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  return (
    <div style={{ padding: 16 }}>
      <h1>Edit Daily Production Submission</h1>
      <DailyProductionForm initialSubmissionId={id} />
    </div>
  );
}
