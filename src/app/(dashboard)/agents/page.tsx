"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server, Plus, Trash2, Copy, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Agent {
  id: string;
  name: string;
  hostname: string | null;
  apiKey: string;
  status: string;
  lastHeartbeat: string | null;
  currentJobId: string | null;
}

export default function AgentsPage() {
  const { data: agents, mutate } = useSWR<Agent[]>("/api/agents", fetcher, {
    refreshInterval: 10000,
  });
  const { t } = useTranslation();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [creating, setCreating] = useState(false);

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), hostname: hostname.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const agent = await res.json();
      setNewApiKey(agent.apiKey);
      setCreateOpen(false);
      setName("");
      setHostname("");
      setApiKeyDialogOpen(true);
      mutate();
      toast.success(t("agents.created"));
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`${res.status}`);
      mutate();
      toast.success(t("agents.deleted"));
    } catch {
      toast.error("Failed to delete agent");
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    toast.success(t("agents.apiKeyCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("agents.title")}</h1>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("agents.addAgent")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("agents.addAgent")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("agents.agentName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("agents.agentNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("agents.hostname")}</Label>
                <Input
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder={t("agents.hostnamePlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {t("agents.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Key display dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("agents.apiKeyTitle")}</DialogTitle>
            <DialogDescription>{t("agents.apiKeyDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-4">
            <Input value={newApiKey} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopyKey}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setApiKeyDialogOpen(false)}>
              {t("agents.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{t("agents.activeAgents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("agents.name")}</TableHead>
                <TableHead>{t("agents.hostname")}</TableHead>
                <TableHead>{t("agents.status")}</TableHead>
                <TableHead>{t("agents.lastHeartbeat")}</TableHead>
                <TableHead>{t("agents.currentJob")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {agent.hostname || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        agent.status === "online"
                          ? "default"
                          : agent.status === "busy"
                          ? "secondary"
                          : "destructive"
                      }
                      className={
                        agent.status === "online"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : agent.status === "busy"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : undefined
                      }
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {agent.lastHeartbeat
                      ? formatDistanceToNow(new Date(agent.lastHeartbeat), {
                          addSuffix: true,
                        })
                      : t("agents.never")}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {agent.currentJobId?.slice(0, 8) || "-"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{agent.name}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("agents.deleteConfirm")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(agent.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {(!agents || agents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t("agents.noAgents")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
