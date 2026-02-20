import { getUserTier } from "@/lib/subscription";

describe("getUserTier", () => {
  it("returns 'growth' as the default stub tier", () => {
    expect(getUserTier("any-user-id")).toBe("growth");
  });

  it("returns a valid SubscriptionTier value", () => {
    const tier = getUserTier("test-user");
    expect(["starter", "growth", "scale"]).toContain(tier);
  });
});
