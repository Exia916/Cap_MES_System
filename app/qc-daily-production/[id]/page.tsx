import QCDailyProductionForm from "../QCDailyProductionForm";

export default function EditQCDailyProductionPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ padding: 16 }}>
      <h1>Edit QC Daily Production</h1>
      <QCDailyProductionForm mode="edit" id={params.id} />
    </div>
  );
}
