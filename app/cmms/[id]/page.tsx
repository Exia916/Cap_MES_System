import TechWorkOrderForm from "./TechWorkOrderForm";

export default async function CMMSWorkOrderPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  return (
    <div style={{ padding: 16 }}>
      <h1>CMMS Work Order #{id}</h1>
      <TechWorkOrderForm id={id} />
    </div>
  );
}