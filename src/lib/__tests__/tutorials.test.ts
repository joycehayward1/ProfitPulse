import { getTutorialsUrl } from "../tutorials";

describe("getTutorialsUrl", () => {
  it("returns null when unset or blank", () => {
    expect(getTutorialsUrl(undefined)).toBeNull();
    expect(getTutorialsUrl("")).toBeNull();
    expect(getTutorialsUrl("   ")).toBeNull();
  });

  it("returns null for relative paths and non-http schemes", () => {
    expect(getTutorialsUrl("/tutorials")).toBeNull();
    expect(getTutorialsUrl("javascript:alert(1)")).toBeNull();
    expect(getTutorialsUrl("mailto:someone@example.test")).toBeNull();
  });

  it("returns an absolute https URL, trimmed", () => {
    expect(getTutorialsUrl("  https://community.example.test/tutorials  ")).toBe(
      "https://community.example.test/tutorials"
    );
  });
});
