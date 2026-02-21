import { UserRole } from "@/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    id?: string;
  }
}
