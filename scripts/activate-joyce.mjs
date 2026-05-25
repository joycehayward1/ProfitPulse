const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const USER_ID = "7d6ba900-1046-4434-936a-9b79c32cd234";

async function rawsql(query, params) {
  const res = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, params }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// 1) Verify her email so she can log in.
const verify = await rawsql(
  "UPDATE auth.users SET email_verified = true, updated_at = NOW() WHERE id = $1 RETURNING id, email, email_verified",
  [USER_ID]
);
console.log("verify:", verify.status, verify.body);

// 2) Update profile with business info (signup script set name; this fills in business_name / industry).
const profileUpdate = await rawsql(
  "UPDATE profiles SET business_name = $1, industry = $2, updated_at = NOW() WHERE id = $3 RETURNING id, business_name, industry",
  ["Fusion 4 Business", "Consulting", USER_ID]
);
console.log("profile:", profileUpdate.status, profileUpdate.body);

// 3) Create a 7-day trial subscription row (mirrors /api/auth/start-trial).
const existing = await rawsql(
  "SELECT id, subscription_status FROM subscriptions WHERE user_id = $1",
  [USER_ID]
);
console.log("existing sub:", existing.status, existing.body);

const exists = JSON.parse(existing.body).rowCount > 0;
if (!exists) {
  const sub = await rawsql(
    `INSERT INTO subscriptions
       (user_id, plan, subscription_status, trial_start_date, trial_end_date)
     VALUES ($1, 'pro', 'trial', NOW(), NOW() + INTERVAL '7 days')
     RETURNING id, subscription_status, trial_end_date`,
    [USER_ID]
  );
  console.log("subscription:", sub.status, sub.body);
} else {
  console.log("subscription already exists, skipping insert");
}
