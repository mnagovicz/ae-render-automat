"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function NewJobPage() {
  const { data: templates } = useSWR("/api/templates", fetcher);
  const { t } = useTranslation();

  const activeTemplates = templates?.filter(
    (t: { isActive: boolean }) => t.isActive
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("jobs.newJob")}</h1>
      <p className="text-muted-foreground">{t("jobs.selectTemplate")}</p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeTemplates?.map(
          (tmpl: {
            id: string;
            name: string;
            description: string | null;
            organization: { name: string };
            _count: { variables: number; footageSlots: number };
          }) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{tmpl.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {tmpl.organization.name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tmpl.description && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    {tmpl.description}
                  </p>
                )}
                <div className="mb-4 flex gap-2">
                  <Badge variant="outline">
                    {tmpl._count.variables} {t("templates.variables").toLowerCase()}
                  </Badge>
                  <Badge variant="outline">
                    {tmpl._count.footageSlots} {t("form.images").toLowerCase()}
                  </Badge>
                </div>
                <Link href={`/jobs/create/${tmpl.id}`}>
                  <Button className="w-full">
                    {t("jobs.createJob")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        )}
        {(!activeTemplates || activeTemplates.length === 0) && (
          <p className="col-span-3 text-center text-muted-foreground">
            {t("jobs.noActiveTemplates")}
          </p>
        )}
      </div>
    </div>
  );
}
