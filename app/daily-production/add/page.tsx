import DailyProductionForm from "../DailyProductionForm";

export default function AddDailyProductionPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Add Daily Production Entry</h1>
      <DailyProductionForm mode="add" />
    </div>
  );
}
