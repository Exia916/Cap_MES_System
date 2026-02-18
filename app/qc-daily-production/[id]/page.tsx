import QCDailyProductionForm from "../QCDailyProductionForm";

export default function EditQCDailyProductionPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ padding: 16 }}>
      <h1>Edit QC Daily Production Submission</h1>
      <QCDailyProductionForm initialSubmissionId={params.id} />
    </div>
  );
}
