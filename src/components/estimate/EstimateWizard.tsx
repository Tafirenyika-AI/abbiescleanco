"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { quoteRequestSchema, type QuoteRequestInput, type QuoteRequestFormValues } from "@/lib/validation/quote";
import { calculateEstimate, conditionLabels, frequencyLabels, defaultPricingConfig, type PricingConfig } from "@/lib/pricing";
import { services as defaultServices, type ServiceId } from "@/lib/data/services";
import Button from "@/components/ui/Button";
import ClaimAccountPrompt from "@/components/account/ClaimAccountPrompt";
import BookNowPicker from "@/components/estimate/BookNowPicker";

const steps = ["Property & Service", "Cleaning Details", "Your Info", "Review & Submit"] as const;

interface SelectableService {
  id: ServiceId;
  name: string;
  isActive?: boolean;
}

function fieldError(message?: string) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}

export default function EstimateWizard({
  pricingConfig = defaultPricingConfig,
  isLoggedIn = false,
  services = defaultServices,
}: {
  pricingConfig?: PricingConfig;
  isLoggedIn?: boolean;
  services?: SelectableService[];
}) {
  const selectableServices = services.filter((s) => s.isActive !== false);
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | {
        status: "success";
        reference: string;
        whatsappUrl: string;
        estimateLabel: string | null;
        email: string;
        leadId?: string;
        serviceId?: ServiceId;
        requiresManualQuote: boolean;
      }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<QuoteRequestFormValues>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      zip: "",
      propertyType: "house",
      squareFeet: 1500,
      bedrooms: 3,
      bathrooms: 2,
      service: (searchParams.get("service") as ServiceId) || "standard-cleaning",
      frequency: "one-time",
      condition: "normal",
      hasPets: false,
      lastProfessionalCleaning: "",
      preferredDate: "",
      addOns: [],
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      preferredContactMethod: "EMAIL",
      additionalInstructions: "",
      promoCode: "",
      smsConsent: false,
      emailConsent: true,
      policiesAccepted: true as const,
      _gotcha: "",
      source: "website",
    },
  });

  useEffect(() => {
    const bedrooms = searchParams.get("bedrooms");
    const bathrooms = searchParams.get("bathrooms");
    if (bedrooms) setValue("bedrooms", Number(bedrooms));
    if (bathrooms) setValue("bathrooms", Number(bathrooms));
    const campaign = searchParams.get("utm_campaign");
    if (campaign) setValue("campaign", campaign);
    const utmSource = searchParams.get("utm_source");
    if (utmSource) setValue("utmSource", utmSource);
    const utmMedium = searchParams.get("utm_medium");
    if (utmMedium) setValue("utmMedium", utmMedium);
    const utmContent = searchParams.get("utm_content");
    if (utmContent) setValue("utmContent", utmContent);
    // Only meaningful when it points away from this site — an internal referrer (e.g. the
    // homepage linking to this page) says nothing about how the visitor first arrived.
    if (typeof document !== "undefined" && document.referrer && !document.referrer.startsWith(window.location.origin)) {
      setValue("referrer", document.referrer.slice(0, 500));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const values = watch();

  // Commercial properties don't have a bedroom count — clear it so the
  // hidden field never submits stale data from an earlier property type.
  useEffect(() => {
    if (values.propertyType === "commercial" && values.bedrooms) {
      setValue("bedrooms", 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.propertyType]);

  const estimate = useMemo(() => {
    return calculateEstimate({
      service: values.service,
      propertyType: values.propertyType,
      squareFeet: Number(values.squareFeet) || 0,
      bedrooms: Number(values.bedrooms) || 0,
      bathrooms: Number(values.bathrooms) || 0,
      condition: values.condition,
      frequency: values.frequency,
      hasPets: Boolean(values.hasPets),
      addOns: values.addOns || [],
    }, pricingConfig);
  }, [values.service, values.propertyType, values.squareFeet, values.bedrooms, values.bathrooms, values.condition, values.frequency, values.hasPets, values.addOns, pricingConfig]);

  const estimateLabel = estimate.requiresManualQuote
    ? "Manual quote required"
    : `$${estimate.totalLow}–$${estimate.totalHigh}`;

  const stepFields: Record<number, (keyof QuoteRequestFormValues)[]> = {
    0: ["zip", "propertyType", "squareFeet", "bedrooms", "bathrooms", "service"],
    1: ["condition", "frequency"],
    2: ["firstName", "lastName", "phone", "email", "preferredContactMethod"],
    3: ["policiesAccepted"],
  };

  async function goNext() {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(data: QuoteRequestFormValues) {
    setSubmitState({ status: "submitting" });
    // zodResolver has already parsed/coerced `data` into QuoteRequestInput by
    // this point; the cast just reconciles RHF's pre-coercion form typing.
    const parsed = data as unknown as QuoteRequestInput;
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSubmitState({ status: "error", message: json.error || "Something went wrong. Please try again." });
        return;
      }
      // The honeypot-rejected path deliberately omits `estimate`/`leadId` (see
      // /api/quote) -- render a plain confirmation rather than "$undefined".
      const label = !json.estimate
        ? null
        : json.estimate.requiresManualQuote
          ? "Manual quote required"
          : `$${json.estimate.totalLow}–$${json.estimate.totalHigh}`;
      setSubmitState({
        status: "success",
        reference: json.reference,
        whatsappUrl: json.whatsappHandoffUrl,
        estimateLabel: label,
        email: parsed.email,
        leadId: json.leadId,
        serviceId: json.serviceId,
        requiresManualQuote: !!json.estimate?.requiresManualQuote,
      });
    } catch {
      setSubmitState({ status: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  if (submitState.status === "success") {
    return (
      <div className="rounded-3xl border border-teal-200 bg-teal-50 p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-12 text-teal-600" aria-hidden />
        <h2 className="mt-4 text-2xl font-semibold text-navy-950">Request received!</h2>
        <p className="mt-2 text-surface-700">
          Your reference number is <strong>{submitState.reference}</strong>. We&apos;ve sent a
          confirmation to your email.
        </p>
        {submitState.estimateLabel && (
          <p className="mt-1 text-surface-700">Preliminary estimate: {submitState.estimateLabel}</p>
        )}
        <p className="mt-4 text-sm text-surface-700">
          This request is pending — our team will follow up to confirm final pricing and your
          preferred date.
        </p>
        {!submitState.requiresManualQuote && submitState.leadId && submitState.serviceId && (
          <BookNowPicker leadId={submitState.leadId} serviceId={submitState.serviceId} />
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href={submitState.whatsappUrl} external size="lg">
            Continue on WhatsApp
          </Button>
          <Button href="/" variant="outline" size="lg">
            Back to home
          </Button>
        </div>
        {!isLoggedIn && <ClaimAccountPrompt email={submitState.email} />}
      </div>
    );
  }

  return (
    <div>
      <ol className="flex items-center gap-2" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i <= step ? "bg-teal-500 text-navy-950" : "bg-surface-200 text-surface-700"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-teal-500" : "bg-surface-200"}`} />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-sm font-medium text-surface-700">
        Step {step + 1} of {steps.length}: {steps[step]}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
        {/* Honeypot field — hidden from real users, catches bots */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          className="sr-only"
          aria-hidden="true"
          {...register("_gotcha")}
        />

        {step === 0 && (
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <legend className="sr-only">Property & service</legend>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">ZIP code</span>
              <input
                type="text"
                inputMode="numeric"
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("zip")}
                aria-invalid={!!errors.zip}
                aria-describedby={errors.zip ? "zip-error" : undefined}
              />
              <span id="zip-error">{fieldError(errors.zip?.message)}</span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Property type</span>
              <select className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("propertyType")}>
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="townhome">Townhome</option>
                <option value="commercial">Commercial</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Approximate square footage</span>
              <input
                type="number"
                min={100}
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("squareFeet", { valueAsNumber: true })}
                aria-invalid={!!errors.squareFeet}
              />
              {fieldError(errors.squareFeet?.message)}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Cleaning service</span>
              <select className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("service")}>
                {selectableServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            {values.propertyType !== "commercial" && (
              <label className="block">
                <span className="text-sm font-semibold text-navy-900">Bedrooms</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                  {...register("bedrooms", { valueAsNumber: true })}
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">
                {values.propertyType === "commercial" ? "Restrooms" : "Bathrooms"}
              </span>
              <input
                type="number"
                min={0}
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("bathrooms", { valueAsNumber: true })}
              />
            </label>

            {values.propertyType === "commercial" && (
              <p className="text-sm text-surface-700 sm:col-span-2">
                Commercial spaces are quoted manually after we review your details — no bedroom
                count needed.
              </p>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <legend className="sr-only">Cleaning details</legend>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Current condition</span>
              <select className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("condition")}>
                {Object.entries(conditionLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Frequency</span>
              <select className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("frequency")}>
                {Object.entries(frequencyLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Last professional cleaning</span>
              <input
                type="text"
                placeholder="e.g. 6 months ago, never"
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("lastProfessionalCleaning")}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Preferred date</span>
              <input
                type="date"
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("preferredDate")}
              />
            </label>

            <label className="flex items-center gap-2.5 sm:col-span-2">
              <input type="checkbox" className="size-4" {...register("hasPets")} />
              <span className="text-sm text-navy-900">I have pets in the home</span>
            </label>

            <div className="sm:col-span-2">
              <span className="text-sm font-semibold text-navy-900">Optional add-ons</span>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {pricingConfig.addOns.map((addOn) => (
                  <label key={addOn.key} className="flex items-center justify-between gap-2 rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" value={addOn.key} className="size-4" {...register("addOns")} />
                      {addOn.label}
                    </span>
                    <span className="text-xs text-surface-700">
                      +${addOn.low}–${addOn.high}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <legend className="sr-only">Your info</legend>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">First name</span>
              <input className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("firstName")} aria-invalid={!!errors.firstName} />
              {fieldError(errors.firstName?.message)}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Last name</span>
              <input className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("lastName")} aria-invalid={!!errors.lastName} />
              {fieldError(errors.lastName?.message)}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Phone</span>
              <input type="tel" className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("phone")} aria-invalid={!!errors.phone} />
              {fieldError(errors.phone?.message)}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Email</span>
              <input type="email" className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("email")} aria-invalid={!!errors.email} />
              {fieldError(errors.email?.message)}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Preferred contact method</span>
              <select className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("preferredContactMethod")}>
                <option value="EMAIL">Email</option>
                <option value="PHONE">Phone</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">Text message</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-navy-900">Additional instructions</span>
              <textarea
                rows={3}
                placeholder="Access instructions, special requests, anything else we should know"
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
                {...register("additionalInstructions")}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Promo code (optional)</span>
              <input
                type="text"
                placeholder="e.g. SPRING10"
                className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm uppercase"
                {...register("promoCode")}
              />
            </label>
            <label className="flex items-center gap-2.5 sm:col-span-2">
              <input type="checkbox" className="size-4" {...register("smsConsent")} />
              <span className="text-sm text-navy-900">I consent to receive SMS updates about this request</span>
            </label>
            <label className="flex items-center gap-2.5 sm:col-span-2">
              <input type="checkbox" className="size-4" {...register("emailConsent")} />
              <span className="text-sm text-navy-900">I consent to receive email updates about this request</span>
            </label>
          </fieldset>
        )}

        {step === 3 && (
          <div>
            <div className="rounded-2xl border border-surface-200 p-5">
              <h3 className="font-semibold text-navy-950">Review your request</h3>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-surface-700">Service</dt><dd className="font-medium text-navy-900">{selectableServices.find((s) => s.id === values.service)?.name}</dd></div>
                <div>
                  <dt className="text-surface-700">Property</dt>
                  <dd className="font-medium text-navy-900">
                    {values.propertyType}, {Number(values.squareFeet)} sq ft
                    {values.propertyType === "commercial"
                      ? `, ${Number(values.bathrooms)} restroom${Number(values.bathrooms) === 1 ? "" : "s"}`
                      : `, ${Number(values.bedrooms)} bed / ${Number(values.bathrooms)} bath`}
                  </dd>
                </div>
                <div><dt className="text-surface-700">ZIP</dt><dd className="font-medium text-navy-900">{values.zip}</dd></div>
                <div><dt className="text-surface-700">Frequency</dt><dd className="font-medium text-navy-900">{frequencyLabels[values.frequency]}</dd></div>
                <div><dt className="text-surface-700">Condition</dt><dd className="font-medium text-navy-900">{conditionLabels[values.condition]}</dd></div>
                <div><dt className="text-surface-700">Add-ons</dt><dd className="font-medium text-navy-900">{values.addOns?.length ? values.addOns.map((a) => pricingConfig.addOns.find((x) => x.key === a)?.label ?? a).join(", ") : "None"}</dd></div>
                <div><dt className="text-surface-700">Contact</dt><dd className="font-medium text-navy-900">{values.firstName} {values.lastName} · {values.phone} · {values.email}</dd></div>
              </dl>
            </div>

            <div className="mt-6 rounded-2xl bg-navy-950 p-6 text-center text-white">
              <p className="text-xs uppercase tracking-wide text-teal-300">Preliminary estimate</p>
              <p className="mt-1 text-3xl font-semibold">{estimateLabel}</p>
              <p className="mt-2 text-xs text-surface-200">
                This is a preliminary estimate only. Final pricing is confirmed after we review
                your property&apos;s details.
              </p>
            </div>

            <label className="mt-6 flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 size-4" {...register("policiesAccepted")} aria-invalid={!!errors.policiesAccepted} />
              <span className="text-sm text-navy-900">
                I understand this is a preliminary estimate and pending appointment request, and I
                agree to the{" "}
                <a href="/policies/terms" className="underline">Terms of Service</a> and{" "}
                <a href="/policies/cancellation" className="underline">Cancellation Policy</a>.
              </span>
            </label>
            {fieldError(errors.policiesAccepted?.message)}

            {submitState.status === "error" && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {submitState.message}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            className={step === 0 ? "invisible" : ""}
          >
            <ChevronLeft className="size-4" aria-hidden /> Back
          </Button>

          {step < steps.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={submitState.status === "submitting"}>
              {submitState.status === "submitting" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
