import WorkOrderForm from "../repair-requests/workOrderForm";

export default function CMMSAddPage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Add CMMS Request</h1>
      <WorkOrderForm mode="add" />
    </div>
  );
}