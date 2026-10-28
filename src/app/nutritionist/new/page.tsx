import { BookingFlow } from "@/components/client/booking-flow";
export const metadata = { title: "Add a booking" };
export default function NewAppointmentPage() {
  return <BookingFlow manual />;
}
