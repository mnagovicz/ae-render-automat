"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { useTranslation } from "@/lib/i18n";

interface HeaderProps {
  userName?: string | null;
  userRole: string;
}

export function Header({ userName, userRole }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <ThemeToggle />
        <div className="text-sm">
          <span className="font-medium">{userName || t("common.user")}</span>
          <span className="ml-2 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
            {userRole}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
