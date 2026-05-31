"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";
import { ensureUser } from "@/lib/checkUser";

export async function updateUser(data) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await ensureUser();
  if (!user) throw new Error("Unauthorized");

  try {
    let insights = null;

    const existingInsight = await db.industryInsight.findUnique({
      where: { industry: data.industry },
    });

    if (!existingInsight) {
      insights = await generateAIInsights(data.industry);
    }

    const updatedUser = await db.$transaction(async (tx) => {
      if (!existingInsight && insights) {
        await tx.industryInsight.create({
          data: {
            industry: data.industry,
            ...insights,
            nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return tx.user.update({
        where: { id: user.id },
        data: {
          industry: data.industry,
          experience: data.experience,
          bio: data.bio ?? null,
          skills: data.skills ?? [],
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error updating user and industry:", error);
    throw new Error(error?.message || "Failed to update profile");
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await ensureUser();
  if (!user) throw new Error("Unauthorized");

  return {
    isOnboarded: !!user.industry,
  };
}
