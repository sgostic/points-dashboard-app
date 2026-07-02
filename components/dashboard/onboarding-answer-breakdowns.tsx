"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useDateRangeBounds } from "./date-range-context";
import { PanelBody } from "./panel-card";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { CHART_COLORS, EmptyState } from "@/components/dashboard/charts/chart-kit";
import { fetchPanel, panelKey, rangeLabel } from "@/lib/dashboard/api-client";
import type { OnboardingQuestionBreakdown, Project, Range, Variant } from "@/lib/dashboard/types";

export function OnboardingAnswerBreakdowns({
  project,
  range,
  variant,
}: {
  project: Project;
  range: Range;
  variant: Variant;
}) {
  const { from, to } = useDateRangeBounds();
  const query = useQuery({
    queryKey: panelKey("onboarding-answer-breakdowns", project, range, { variant, from, to }),
    queryFn: () => fetchPanel<OnboardingQuestionBreakdown[]>("onboarding-answer-breakdowns", { project, range, variant, from, to }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Onboarding answer mix</CardTitle>
          <p className="text-sm text-ink-secondary">Percentage split for each onboarding question.</p>
        </div>
        <Badge>{rangeLabel(range, from, to)}</Badge>
      </CardHeader>
      <CardContent>
        <PanelBody query={query}>
          {(data) => {
            if (!data.length || data.every((question) => question.responses === 0)) {
              return <EmptyState />;
            }

            return (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.map((question) => (
                  <div key={question.questionId} className="rounded-xl border border-edge bg-surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-brand-ink">{question.questionLabel}</h3>
                        <p className="mt-1 text-xs text-ink-secondary">
                          {question.responses.toLocaleString()} respondents
                        </p>
                      </div>
                    </div>

                    {question.answers.length ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:items-center">
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={question.answers}
                                dataKey="count"
                                nameKey="answer"
                                innerRadius={42}
                                outerRadius={72}
                                paddingAngle={2}
                                stroke="none"
                              >
                                {question.answers.map((answer, index) => (
                                  <Cell key={answer.answer} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<AnswerTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="space-y-2">
                          {question.answers.map((answer, index) => (
                            <div key={answer.answer} className="space-y-1">
                              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                  aria-hidden="true"
                                />
                                <span className="truncate text-brand-ink">{answer.answer}</span>
                                <span className="whitespace-nowrap text-ink-secondary">
                                  {answer.percentage}% · {answer.count}
                                </span>
                              </div>

                              {answer.otherInputs?.length ? (
                                <div className="ml-[5px] border-l border-edge-strong pl-4">
                                  <div className="space-y-1">
                                    {answer.otherInputs.map((input) => (
                                      <div
                                        key={input.name}
                                        className="grid grid-cols-[1fr_auto] items-start gap-2 text-xs"
                                      >
                                        <span className="min-w-0 break-words text-brand-ink">{input.name}</span>
                                        <span className="whitespace-nowrap text-ink-secondary">
                                          {input.count.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <EmptyState label="No answers captured for this question" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          }}
        </PanelBody>
      </CardContent>
    </Card>
  );
}

function AnswerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { answer: string; count: number; percentage: number; otherInputs?: Array<{ name: string; count: number }> } }>;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-edge bg-surface-elevated px-3 py-2 text-xs text-brand-ink shadow-sm">
      <div className="font-semibold">{item.answer}</div>
      <div className="mt-1">{item.percentage}% of respondents</div>
      <div>{item.count.toLocaleString()} answers</div>
    </div>
  );
}
