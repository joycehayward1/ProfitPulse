import { InsForgeClient } from "@insforge/sdk";

const admin = new InsForgeClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: process.env.INSFORGE_API_KEY,
});

const res = await fetch(`${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/advance/rawsql/unrestricted`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`,
  },
  body: JSON.stringify({
    query: "SELECT * FROM auth.users WHERE email = $1",
    params: ["joyce@fusion4business.com"],
  }),
});

console.log("status:", res.status);
console.log(await res.text());
