"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data } = useSWR(`/api/jobs${queryParams}`, fetcher, {
    refreshInterval: 5000,
  });
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("jobs.title")}</h1>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t("jobs.newJob")}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("jobs.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("jobs.allStatuses")}</SelectItem>
            <SelectItem value="PENDING">{t("status.pending")}</SelectItem>
            <SelectItem value="DOWNLOADING">{t("status.downloading")}</SelectItem>
            <SelectItem value="RENDERING">{t("status.rendering")}</SelectItem>
            <SelectItem value="UPLOADING">{t("status.uploading")}</SelectItem>
            <SelectItem value="COMPLETED">{t("status.completed")}</SelectItem>
            <SelectItem value="FAILED">{t("status.failed")}</SelectItem>
            <SelectItem value="MANUAL">{t("status.manual")}</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} {t("jobs.jobsTotal")}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("jobs.job")}</TableHead>
                <TableHead>{t("jobs.template")}</TableHead>
                <TableHead>{t("jobs.createdBy")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("jobs.progress")}</TableHead>
                <TableHead>{t("jobs.agent")}</TableHead>
                <TableHead>{t("jobs.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.jobs?.map(
                (job: {
                  id: string;
                  jobName: string | null;
                  status: "PENDING" | "DOWNLOADING" | "RENDERING" | "UPLOADING" | "COMPLETED" | "FAILED" | "MANUAL";
                  progress: number;
                  createdAt: string;
                  template: { name: string };
                  createdBy: { name: string | null; email: string };
                  agent: { name: string } | null;
                }) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.jobName || job.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{job.template.name}</TableCell>
                    <TableCell>
                      {job.createdBy.name || job.createdBy.email}
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      {["DOWNLOADING", "RENDERING", "UPLOADING"].includes(
                        job.status
                      ) ? (
                        <Progress value={job.progress} className="w-24" />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {job.progress}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.agent?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(job.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!data?.jobs || data.jobs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t("jobs.noJobs")}
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
