"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  Users,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: {
    members: number;
    templates: number;
  };
}

interface Member {
  id: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const {
    data: org,
    error: orgError,
    isLoading: orgLoading,
  } = useSWR<OrganizationDetail>(`/api/organizations/${id}`, fetcher);

  const {
    data: members,
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR<Member[]>(`/api/organizations/${id}/members`, fetcher);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/organizations/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add member");
      }

      const data = await res.json();

      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setAddDialogOpen(false);
      mutateMembers();

      if (data.generatedPassword) {
        setCreatedCredentials({
          email: data.user.email,
          password: data.generatedPassword,
        });
        setCredentialsDialogOpen(true);
      } else {
        toast.success(t("orgDetail.memberAdded"));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("orgDetail.memberAddFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingUserId(userId);

    try {
      const res = await fetch(`/api/organizations/${id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      toast.success(t("orgDetail.memberRemoved"));
      mutateMembers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("orgDetail.memberRemoveFailed")
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  function handleCopyCredentials() {
    if (!createdCredentials) return;
    const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (orgError || membersError) {
    return (
      <div className="space-y-6">
        <Link
          href="/organizations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("orgDetail.backToOrgs")}
        </Link>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {t("orgDetail.loadError")}
        </div>
      </div>
    );
  }

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/organizations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t("orgDetail.backToOrgs")}
      </Link>

      {/* Organization header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org?.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary">{org?.slug}</Badge>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {org?._count.members} {t("orgDetail.members")}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {org?._count.templates} {t("orgDetail.templates")}
            </span>
          </div>
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("orgDetail.membersTitle")}</h2>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("orgDetail.addClient")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("orgDetail.addClient")}</DialogTitle>
                <DialogDescription>
                  {t("orgDetail.addClientDesc")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="member-name">{t("common.name")}</Label>
                  <Input
                    id="member-name"
                    placeholder="Jan Novak"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-email">{t("orgDetail.email")}</Label>
                  <Input
                    id="member-email"
                    type="email"
                    placeholder="jan@firma.cz"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-password">
                    {t("orgDetail.password")}
                  </Label>
                  <Input
                    id="member-password"
                    type="text"
                    placeholder={t("orgDetail.passwordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("orgDetail.passwordHint")}
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("orgDetail.addClient")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members && members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-8">
            <Users className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("orgDetail.noMembers")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("orgDetail.email")}</TableHead>
                  <TableHead>{t("orgDetail.role")}</TableHead>
                  <TableHead>{t("orgDetail.addedAt")}</TableHead>
                  <TableHead className="w-[80px]">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user.name || "—"}
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={removingUserId === member.user.id}
                          >
                            {removingUserId === member.user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("orgDetail.removeMember")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("orgDetail.removeConfirm", {
                                name: member.user.name || member.user.email,
                              })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("common.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRemoveMember(member.user.id)
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {t("orgDetail.remove")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Credentials dialog (shown after creating a new user) */}
      <Dialog
        open={credentialsDialogOpen}
        onOpenChange={(open) => {
          setCredentialsDialogOpen(open);
          if (!open) setCreatedCredentials(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orgDetail.credentialsTitle")}</DialogTitle>
            <DialogDescription>
              {t("orgDetail.credentialsDesc")}
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-4 font-mono text-sm">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  {createdCredentials.email}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("orgDetail.password")}:{" "}
                  </span>
                  {createdCredentials.password}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyCredentials}
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied
                  ? t("orgDetail.copied")
                  : t("orgDetail.copyCredentials")}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentialsDialogOpen(false)}>
              {t("orgDetail.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
