import { InsForgeClient } from "@insforge/sdk";

const EMAIL = "joyce@fusion4business.com";
const PASSWORD = process.argv[2];
const NAME = "Joyce Hayward";
const BUSINESS_NAME = "Fusion 4 Business";
const INDUSTRY = "Consulting";

if (!PASSWORD) {
  console.error("Usage: node scripts/create-joyce.mjs <password>");
  process.exit(1);
}

const client = new InsForgeClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});

const { data, error } = await client.auth.signUp({
  email: EMAIL,
  password: PASSWORD,
  name: NAME,
});

if (error) {
  console.error("signUp failed:", error.message ?? error);
  process.exit(1);
}

console.log("signUp ok:", {
  userId: data?.user?.id,
  email: data?.user?.email,
  requireEmailVerification: data?.requireEmailVerification,
});

if (data?.user?.id) {
  const userId = data.user.id;

  const profileUpdate = await client.database
    .from("profiles")
    .update({ business_name: BUSINESS_NAME, industry: INDUSTRY })
    .eq("id", userId);
  if (profileUpdate.error) {
    console.warn("profile update warn:", profileUpdate.error.message);
  } else {
    console.log("profile updated");
  }

  // Mirror /api/auth/start-trial logic — create the trial subscription row.
  const admin = new InsForgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.INSFORGE_API_KEY,
  });

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const { data: existingSub } = await admin.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingSub) {
    const insert = await admin.database.from("subscriptions").insert({
      user_id: userId,
      plan: "pro",
      subscription_status: "trial",
      trial_start_date: now.toISOString(),
      trial_end_date: trialEnd.toISOString(),
    });
    if (insert.error) {
      console.warn("subscription insert warn:", insert.error.message);
    } else {
      console.log("trial subscription created");
    }
  } else {
    console.log("subscription already existed:", existingSub.subscription_status);
  }
}
