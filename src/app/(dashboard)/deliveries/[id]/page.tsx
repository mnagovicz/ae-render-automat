"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Destination {
  id: string;
  name: string;
  type: "FTP" | "SFTP" | "WEBHOOK";
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  path: string | null;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string> | null;
  isActive: boolean;
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: destination, mutate } = useSWR<Destination>(`/api/deliveries/${id}`, fetcher);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Destination>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (destination && !ready) {
      setForm({
        name: destination.name,
        type: destination.type,
        host: destination.host,
        port: destination.port,
        username: destination.username,
        password: destination.password,
        path: destination.path,
        webhookUrl: destination.webhookUrl,
        webhookHeaders: destination.webhookHeaders,
        isActive: destination.isActive,
      });
      setReady(true);
    }
  }, [destination, ready]);

  function updateForm(updates: Partial<Destination>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success(t("toast.deliverySaved"));
      mutate();
    } catch {
      toast.error(t("toast.deliverySaveFailed"));
    }
    setSaving(false);
  }

  if (!destination || !ready) {
    return <div>{t("common.loading")}</div>;
  }

  const isFtpType = form.type === "FTP" || form.type === "SFTP";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/deliveries">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{destination.name}</h1>
            <p className="text-sm text-muted-foreground">{t("deliveries.editTitle")}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? t("templates.editor.saving") : t("common.save")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("form.general")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input
                value={form.name || ""}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("deliveries.type")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateForm({ type: v as Destination["type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FTP">FTP</SelectItem>
                  <SelectItem value="SFTP">SFTP</SelectItem>
                  <SelectItem value="WEBHOOK">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(checked) => updateForm({ isActive: !!checked })}
            />
            <Label htmlFor="isActive">{t("deliveries.active")}</Label>
          </div>
        </CardContent>
      </Card>

      {isFtpType && (
        <Card>
          <CardHeader>
            <CardTitle>{t("deliveries.connectionSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("deliveries.host")}</Label>
                <Input
                  value={form.host || ""}
                  onChange={(e) => updateForm({ host: e.target.value })}
                  placeholder="ftp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("deliveries.port")}</Label>
                <Input
                  type="number"
                  value={form.port || ""}
                  onChange={(e) => updateForm({ port: parseInt(e.target.value) || null })}
                  placeholder={form.type === "SFTP" ? "22" : "21"}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("deliveries.username")}</Label>
                <Input
                  value={form.username || ""}
                  onChange={(e) => updateForm({ username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("deliveries.password")}</Label>
                <Input
                  type="password"
                  value={form.password || ""}
                  onChange={(e) => updateForm({ password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("deliveries.path")}</Label>
              <Input
                value={form.path || ""}
                onChange={(e) => updateForm({ path: e.target.value })}
                placeholder="/uploads/spots/"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {form.type === "WEBHOOK" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("deliveries.webhookSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("deliveries.webhookUrl")}</Label>
              <Input
                value={form.webhookUrl || ""}
                onChange={(e) => updateForm({ webhookUrl: e.target.value })}
                placeholder="https://api.example.com/deliver"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("deliveries.webhookHeaders")}</Label>
              <Input
                value={form.webhookHeaders ? JSON.stringify(form.webhookHeaders) : ""}
                onChange={(e) => {
                  try {
                    updateForm({ webhookHeaders: JSON.parse(e.target.value) });
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
                placeholder='{"Authorization": "Bearer ..."}'
              />
              <p className="text-xs text-muted-foreground">{t("deliveries.webhookHeadersHint")}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
