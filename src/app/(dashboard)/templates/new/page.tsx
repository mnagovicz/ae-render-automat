"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function NewTemplatePage() {
  const router = useRouter();
  const { data: orgs } = useSWR("/api/organizations", fetcher);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Create template
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description"),
          organizationId: formData.get("organizationId"),
          exportCompName: formData.get("exportCompName") || "___Fotbal_Chance_export",
        }),
      });

      if (!res.ok) throw new Error("Failed to create template");
      const template = await res.json();

      // Upload AEP file if provided
      if (file) {
        await fetch(`/api/templates/${template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aepFileName: file.name,
            aepFileSize: file.size,
          }),
        });
      }

      toast.success(t("toast.templateCreated"));
      router.push(`/templates/${template.id}/editor`);
    } catch {
      toast.error(t("toast.templateCreateFailed"));
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("templates.new.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("templates.new.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("templates.new.templateName")}</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. TIPSPORT Chance Liga v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("templates.new.description")}</Label>
              <Textarea
                id="description"
                name="description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationId">{t("templates.new.organization")}</Label>
              <Select name="organizationId" required>
                <SelectTrigger>
                  <SelectValue placeholder={t("templates.selectOrg")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.map((org: { id: string; name: string }) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exportCompName">{t("templates.new.exportCompName")}</Label>
              <Input
                id="exportCompName"
                name="exportCompName"
                defaultValue="___Fotbal_Chance_export"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aepFile">{t("templates.new.aepFile")}</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="aepFile"
                  type="file"
                  accept=".aep,.aepx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <Upload className="inline h-3 w-3" /> {t("templates.new.uploadHint")}
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("templates.new.creating") : t("templates.new.createAndOpen")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
