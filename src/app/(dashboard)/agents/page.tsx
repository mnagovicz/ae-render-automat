"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AgentsPage() {
  const { data: agents } = useSWR("/api/agents", fetcher, {
    refreshInterval: 10000,
  });
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("agents.title")}</h1>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map(
                (agent: {
                  id: string;
                  name: string;
                  hostname: string | null;
                  status: string;
                  lastHeartbeat: string | null;
                  currentJobId: string | null;
                }) => (
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
                  </TableRow>
                )
              )}
              {(!agents || agents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
