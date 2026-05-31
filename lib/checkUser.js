import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const ensureUser = async () => {
  let clerkUser = null;

  try {
    clerkUser = await currentUser();
  } catch {
    return null;
  }

  if (!clerkUser) {
    return null;
  }

  try {
    const existing = await db.user.findUnique({
      where: { clerkUserId: clerkUser.id },
    });

    if (existing) {
      return existing;
    }

    const name =
      `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
      clerkUser.username ||
      clerkUser.emailAddresses?.[0]?.emailAddress?.split("@")?.[0] ||
      "User";

    const email =
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      `${clerkUser.id}@users.clerk.local`;

    return await db.user.create({
      data: {
        clerkUserId: clerkUser.id,
        name,
        imageUrl: clerkUser.imageUrl ?? null,
        email,
      },
    });
  } catch (error) {
    // Another request may have created the user concurrently (e.g. Header + onboarding page)
    if (error?.code === "P2002") {
      return db.user.findUnique({
        where: { clerkUserId: clerkUser.id },
      });
    }

    console.error("ensureUser error:", error.message);
    throw error;
  }
};

export const checkUser = ensureUser;
