import QCDailyProductionForm from "../QCDailyProductionForm";

export default function AddQCDailyProductionPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Add QC Daily Production</h1>
      <QCDailyProductionForm mode="add" />
    </div>
  );
}
