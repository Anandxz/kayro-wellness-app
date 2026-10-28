import { Suspense } from "react";
import { BookingConfirmation } from "@/components/client/confirmation";
export const metadata = { title: "Your confirmation" };
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Finding your visit…</p>}>
      <BookingConfirmation id={id} />
    </Suspense>
  );
}
