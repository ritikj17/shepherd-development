import {
  AlertTriangle,
  CheckCircle2,
  FileScan,
  Info,
  ScanText,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import { RiskMeter } from "@/components/shared/risk-meter";
import {
  AnalysisStatusBadge,
  CategoryBadge,
} from "@/components/shared/status-badges";
import { formatDateTime, formatRelative } from "@/lib/utils/format";
import { formatModelScore } from "@/lib/utils/risk";
import type { ThreatAnalysis } from "@/lib/types/api";

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AnalysisResult({
  analysis,
  incidentDescription,
  sample = false,
}: {
  analysis: ThreatAnalysis;
  incidentDescription?: string;
  sample?: boolean;
}) {
  const ocrText =
    analysis.ocr.status === "completed" && analysis.ocr.text_available
      ? analysis.ocr.extracted_text
      : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-[#e2d7bb] bg-[#fbf7ee] text-[#74500a]">
                <Sparkles className="size-3" />
                AI-assisted result
              </Badge>
              {sample ? (
                <Badge variant="muted" className="uppercase tracking-[0.08em]">
                  Sample data
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <AnalysisStatusBadge status={analysis.status} />
              <span className="text-[11px] text-muted-foreground">
                {formatRelative(analysis.created_at)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-lg">
              Classification: {humanize(analysis.classification.label)}
            </CardTitle>
            <CardDescription>
              Recorded {formatDateTime(analysis.created_at)}. This is a
              model-assisted label, not a verified fact.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={analysis.classification.label} />
            <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
              Model score{" "}
              <span className="font-mono font-medium text-foreground">
                {formatModelScore(analysis.classification.confidence)}
              </span>{" "}
              · not a calibrated probability
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysis.status === "failed" ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <div>
                <AlertTitle>Analysis did not complete</AlertTitle>
                <AlertDescription>
                  No successful result is claimed. You can adjust the inputs and
                  try again.
                </AlertDescription>
              </div>
            </Alert>
          ) : null}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Why this label
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
              {analysis.classification.explanation}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/25 p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Indicators
              </p>
              {analysis.indicators.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No specific indicators were returned.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {analysis.indicators.map((indicator) => (
                    <li key={indicator.name} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"
                      />
                      <div>
                        <p className="text-xs font-medium">
                          {humanize(indicator.name)}
                        </p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {indicator.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/25 p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Inputs reviewed
              </p>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <FileScan className="size-3.5" />
                  {incidentDescription
                    ? "Incident description included"
                    : "Incident description not available in this view"}
                </p>
                <p className="flex items-center gap-1.5">
                  <ScanText className="size-3.5" />
                  OCR status: {humanize(analysis.ocr.status)}
                  {ocrText ? " · text available" : ""}
                </p>
                <p className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  No automatic contact or dispatch was triggered.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review-priority score</CardTitle>
          <CardDescription>
            A transparent indicator built from configured factors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RiskMeter
            score={analysis.risk.score}
            level={analysis.risk.level}
            explanation={analysis.risk.explanation}
            factors={analysis.risk.factors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extracted text</CardTitle>
          <CardDescription>
            OCR output is kept separate from the description you wrote.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.ocr.status === "failed" ? (
            <Alert variant="warning">
              <AlertTriangle />
              <div>
                <AlertTitle>OCR did not complete</AlertTitle>
                <AlertDescription>
                  No extracted text is available. You can still review the
                  description and original evidence.
                </AlertDescription>
              </div>
            </Alert>
          ) : ocrText ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" className="gap-1">
                  <ScanText className="size-3" />
                  OCR-extracted text
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Not written by you
                </span>
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground/90">
                {ocrText}
              </pre>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" />
                Extracted text may contain errors. Always compare it with the
                original image.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {analysis.ocr.status === "not_applicable"
                ? "OCR was not applicable to this analysis. Only the incident description was reviewed."
                : "No extracted text was returned."}
            </p>
          )}

          {incidentDescription ? (
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                User-provided description
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {incidentDescription}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limitations</CardTitle>
          <CardDescription>
            Read these before using the result to make decisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.limitations.map((limitation) => (
              <li
                key={limitation}
                className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
                {limitation}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <AiDisclosure variant="analysis" sample={sample} />
    </div>
  );
}
