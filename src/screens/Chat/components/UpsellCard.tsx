import { useEffect, useState } from "react";
import type { UpsellResult } from "../../../api/types";
import { Button } from "../../../components/Button";

export type UpsellUserAction = "ACCEPTED" | "DECLINED" | "DISMISSED";
type LocalDecision = Lowercase<UpsellUserAction> | null;

interface UpsellCardProps {
  upsell: UpsellResult;
  sessionId: string;
  traceId: string;
  disabled?: boolean;
  onRespond: (action: UpsellUserAction) => Promise<boolean>;
}

function formatOfferType(offerType: string): string {
  return offerType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decisionStorageKey(
  sessionId: string,
  upsell: UpsellResult,
  traceId: string,
): string {
  const fallbackKey = traceId || "service-offer";
  const offerKey =
    upsell.decision_id ?? upsell.offer?.offer_type ?? fallbackKey;
  return `neutail_upsell_decision_${sessionId}_${offerKey}`;
}

function readDecision(key: string): LocalDecision {
  try {
    const value = sessionStorage.getItem(key);
    return value === "accepted" || value === "declined" || value === "dismissed"
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeDecision(key: string, decision: Exclude<LocalDecision, null>): void {
  try {
    sessionStorage.setItem(key, decision);
  } catch {
    // The decision still remains in component state when storage is unavailable.
  }
}

export function UpsellCard({
  upsell,
  sessionId,
  traceId,
  disabled = false,
  onRespond,
}: UpsellCardProps) {
  const offerType = upsell.offer?.offer_type ?? "SERVICE_OFFER";
  const title = upsell.offer?.title ?? formatOfferType(offerType);
  const isStylePlus = offerType === "STYLE_PLUS_TRIAL" || offerType === "STYLE_PLUS";
  const isAdvisory = offerType === "STYLING_ADVISORY";
  const storageKey = decisionStorageKey(sessionId, upsell, traceId);

  const [decision, setDecision] = useState<LocalDecision>(() => readDecision(storageKey));
  const [showConsent, setShowConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!showConsent) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowConsent(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showConsent]);

  async function respond(action: UpsellUserAction) {
    setIsSubmitting(true);
    try {
      const recorded = await onRespond(action);
      if (recorded) {
        const nextDecision = action.toLowerCase() as Exclude<LocalDecision, null>;
        writeDecision(storageKey, nextDecision);
        setDecision(nextDecision);
        setShowConsent(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (decision) {
    const confirmation =
      decision === "accepted"
        ? isAdvisory
          ? "Your styling request was sent. Your stylist will continue in chat."
          : "Your interest was recorded. No trial or subscription was started automatically."
        : decision === "declined"
          ? "Offer declined."
          : "Offer dismissed for this session.";

    return (
      <div className="max-w-sm rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-medium uppercase text-neutral-500">Neu.Tail Concierge</p>
        <p className="mt-1 text-sm font-semibold text-neutral-800">{title}</p>
        <p className="mt-1 text-xs text-neutral-500">{confirmation}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`max-w-sm rounded-xl border p-4 ${
          isAdvisory
            ? "border-sky-200 bg-sky-50"
            : "border-violet-200 bg-violet-50"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p
            className={`text-xs font-medium uppercase ${
              isAdvisory ? "text-sky-700" : "text-violet-700"
            }`}
          >
            {isAdvisory ? "Personal styling support" : "Neu.Tail Concierge"}
          </p>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            Optional
          </span>
        </div>

        <p
          className={`mt-1 text-sm font-semibold ${
            isAdvisory ? "text-sky-950" : "text-violet-950"
          }`}
        >
          {title}
        </p>

        {upsell.message && (
          <p className={`mt-1 text-sm ${isAdvisory ? "text-sky-800" : "text-violet-800"}`}>
            {upsell.message}
          </p>
        )}

        {!upsell.message && upsell.offer?.description && (
          <p className={`mt-1 text-sm ${isAdvisory ? "text-sky-800" : "text-violet-800"}`}>
            {upsell.offer.description}
          </p>
        )}

        {(upsell.requires_customer_consent ||
          upsell.offer?.requires_explicit_consent) && (
          <p className="mt-2 text-xs text-neutral-600">
            Nothing will be activated without your confirmation.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            className="px-3 py-1.5 text-xs"
            disabled={disabled || isSubmitting}
            onClick={() => {
              if (isStylePlus) {
                setShowConsent(true);
              } else {
                void respond("ACCEPTED");
              }
            }}
          >
            {isSubmitting
              ? "Sending…"
              : isAdvisory
                ? "Ask a stylist"
                : isStylePlus
                  ? "Review offer"
                  : "Learn more"}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={disabled || isSubmitting}
            onClick={() => void respond("DISMISSED")}
          >
            Not now
          </Button>
        </div>
      </div>

      {showConsent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setShowConsent(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upsell-consent-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-violet-700">Optional offer</p>
                <h2 id="upsell-consent-title" className="mt-1 text-lg font-semibold">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close offer details"
                className="text-neutral-400 hover:text-neutral-700"
                onClick={() => setShowConsent(false)}
              >
                ✕
              </button>
            </div>

            {upsell.offer?.description && (
              <p className="mt-3 text-sm text-neutral-600">{upsell.offer.description}</p>
            )}
            {upsell.message && <p className="mt-3 text-sm text-neutral-700">{upsell.message}</p>}

            <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
              Confirming records your interest and continues the conversation. It does not
              enroll you, begin a trial, or start a subscription automatically.
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                autoFocus
                disabled={disabled || isSubmitting}
                onClick={() => void respond("ACCEPTED")}
              >
                {isSubmitting ? "Sending…" : "I'm interested"}
              </Button>
              <Button
                variant="secondary"
                disabled={disabled || isSubmitting}
                onClick={() => void respond("DECLINED")}
              >
                No thanks
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
