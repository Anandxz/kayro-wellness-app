import { VisitDetails } from "@/components/client/visit-details";
export const metadata = { title: "Visit details" };
export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VisitDetails id={id} />;
}
