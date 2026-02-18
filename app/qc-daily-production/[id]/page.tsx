import QCDailyProductionForm from "../QCDailyProductionForm";

export default async function EditQCDailyProductionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 16 }}>
      <h1>Edit QC Daily Production Submission</h1>
      <QCDailyProductionForm initialSubmissionId={id} />
    </div>
  );
}
