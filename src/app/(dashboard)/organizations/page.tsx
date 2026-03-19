"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Trash2, Building2, Loader2, Pencil } from "lucide-react";
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

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
    templates: number;
  };
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

export default function OrganizationsPage() {
  const { data: organizations, error, isLoading, mutate } = useSWR<Organization[]>(
    "/api/organizations",
    fetcher
  );
  const { t } = useTranslation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setSlug(generatedSlug);
  }

  function openEditDialog(org: Organization) {
    setEditingOrg(org);
    setEditName(org.name);
    setEditSlug(org.slug);
    setEditDialogOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }
      toast.success(t("toast.orgCreated"));
      setName("");
      setSlug("");
      setCreateDialogOpen(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrg) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/organizations/${editingOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update organization");
      }
      toast.success(t("common.save"));
      setEditDialogOpen(false);
      setEditingOrg(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete organization");
      }
      toast.success(t("toast.orgDeleted"));
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("organizations.title")}</h1>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {t("orgs.loadError")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("organizations.title")}</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("organizations.addOrg")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("organizations.addOrg")}</DialogTitle>
              <DialogDescription>{t("orgs.createOrgDesc")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">{t("organizations.name")}</Label>
                <Input
                  id="org-name"
                  placeholder="My Organization"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">{t("organizations.slug")}</Label>
                <Input
                  id="org-slug"
                  placeholder="my-organization"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  title="Lowercase alphanumeric with hyphens only"
                  required
                />
                <p className="text-xs text-muted-foreground">{t("orgs.slugHint")}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : organizations && organizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("organizations.noOrgs")}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("organizations.name")}</TableHead>
                <TableHead>{t("organizations.slug")}</TableHead>
                <TableHead>{t("organizations.members")}</TableHead>
                <TableHead>{t("organizations.templates")}</TableHead>
                <TableHead>{t("organizations.created")}</TableHead>
                <TableHead className="w-[100px]">{t("organizations.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <Link href={`/organizations/${org.id}`} className="hover:underline">
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{org.slug}</Badge>
                  </TableCell>
                  <TableCell>{org._count.members}</TableCell>
                  <TableCell>{org._count.templates}</TableCell>
                  <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(org)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deletingId === org.id}>
                            {deletingId === org.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("organizations.deleteOrg")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("organizations.deleteConfirm")}
                              {(org._count.members > 0 || org._count.templates > 0) && (
                                <span className="mt-2 block font-medium text-yellow-600 dark:text-yellow-400">
                                  {"⚠️ " + t("orgs.deleteConfirm", { name: org.name })}
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(org.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("organizations.editOrg")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">{t("organizations.name")}</Label>
              <Input
                id="edit-org-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-org-slug">{t("organizations.slug")}</Label>
              <Input
                id="edit-org-slug"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                title="Lowercase alphanumeric with hyphens only"
                required
              />
              <p className="text-xs text-muted-foreground">{t("orgs.slugHint")}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
