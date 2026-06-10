import { redirect } from "next/navigation";

/**
 * The launch pricing offer has ended. Anyone landing on a shared /launch
 * link is sent to the standard pricing section instead of a 404.
 */
export default function LaunchPage() {
  redirect("/#pricing");
}
