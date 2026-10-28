import { BookingFlow } from "@/components/client/booking-flow";
export const metadata = { title: "Reschedule your visit" };
export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingFlow rescheduleId={id} />;
}
