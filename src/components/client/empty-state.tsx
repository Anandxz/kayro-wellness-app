import { ButtonLink, Icon } from "@/components/ui";
export function EmptyState({ past = false }: { past?: boolean }) {
  return (
    <div className="card empty-state">
      <div className="round-icon">
        <Icon name="leaf" />
      </div>
      <h2>
        {past
          ? "Every journey starts somewhere."
          : "A little room for yourself."}
      </h2>
      <p className="muted">
        {past
          ? "Your completed and cancelled consultations will appear here."
          : "You don’t have an upcoming consultation. When you’re ready, let’s find a time that fits your life."}
      </p>
      {!past && (
        <ButtonLink href="/book">
          Book a consultation
          <Icon name="arrow" />
        </ButtonLink>
      )}
    </div>
  );
}
