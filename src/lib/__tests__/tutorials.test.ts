import {
  DEFAULT_TUTORIALS_URL,
  chooseTutorialsUrl,
  normalizeTutorialsUrl,
  parseTutorialsUrlInput,
  resolveTutorialsUrl,
} from "../tutorials";

const COMMUNITY =
  "https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247";

describe("normalizeTutorialsUrl", () => {
  it("returns null when unset or blank", () => {
    expect(normalizeTutorialsUrl(undefined)).toBeNull();
    expect(normalizeTutorialsUrl(null)).toBeNull();
    expect(normalizeTutorialsUrl("")).toBeNull();
    expect(normalizeTutorialsUrl("   ")).toBeNull();
  });

  it("returns null for relative paths, non-http schemes and embedded credentials", () => {
    expect(normalizeTutorialsUrl("/tutorials")).toBeNull();
    expect(normalizeTutorialsUrl("community.example.test/tutorials")).toBeNull();
    expect(normalizeTutorialsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeTutorialsUrl("mailto:someone@example.test")).toBeNull();
    expect(normalizeTutorialsUrl("https://user:pass@community.example.test/")).toBeNull();
    expect(normalizeTutorialsUrl(`https://example.test/${"a".repeat(2100)}`)).toBeNull();
  });

  it("returns an absolute https URL, trimmed", () => {
    expect(normalizeTutorialsUrl("  https://community.example.test/tutorials  ")).toBe(
      "https://community.example.test/tutorials"
    );
  });
});

describe("the default address", () => {
  it("is the community tutorials page and is itself valid", () => {
    expect(DEFAULT_TUTORIALS_URL).toBe(COMMUNITY);
    expect(normalizeTutorialsUrl(DEFAULT_TUTORIALS_URL)).toBe(COMMUNITY);
  });
});

describe("chooseTutorialsUrl", () => {
  const env = "https://env.example.test/tutorials";

  it("uses the default when nothing is saved and no env fallback is set", () => {
    expect(chooseTutorialsUrl(null, undefined)).toEqual({ url: COMMUNITY, source: "default" });
    expect(chooseTutorialsUrl(undefined, "")).toEqual({ url: COMMUNITY, source: "default" });
  });

  it("uses the env value as a fallback when nothing is saved", () => {
    expect(chooseTutorialsUrl(null, env)).toEqual({ url: env, source: "env" });
  });

  it("ignores an invalid env value and uses the default", () => {
    expect(chooseTutorialsUrl(null, "javascript:alert(1)")).toEqual({ url: COMMUNITY, source: "default" });
  });

  it("lets a saved address win over the env fallback", () => {
    expect(chooseTutorialsUrl("https://saved.example.test/page", env)).toEqual({
      url: "https://saved.example.test/page",
      source: "saved",
    });
  });

  it("hides the link when an admin saved an empty value, even with an env fallback", () => {
    expect(chooseTutorialsUrl("", env)).toEqual({ url: null, source: "hidden" });
    expect(chooseTutorialsUrl("   ", env)).toEqual({ url: null, source: "hidden" });
  });

  it("hides the link when the saved value isn't an http(s) URL; it does not fall back", () => {
    expect(chooseTutorialsUrl("javascript:alert(1)", env)).toEqual({ url: null, source: "hidden" });
    expect(chooseTutorialsUrl("/relative", env)).toEqual({ url: null, source: "hidden" });
  });

  it("resolveTutorialsUrl returns just the address", () => {
    expect(resolveTutorialsUrl("", env)).toBeNull();
    expect(resolveTutorialsUrl(null, undefined)).toBe(COMMUNITY);
  });
});

describe("parseTutorialsUrlInput", () => {
  it("accepts an empty box, which hides the link", () => {
    expect(parseTutorialsUrlInput("")).toEqual({ ok: true, value: "" });
    expect(parseTutorialsUrlInput("   ")).toEqual({ ok: true, value: "" });
  });

  it("accepts and tidies an absolute address", () => {
    expect(parseTutorialsUrlInput(" https://community.example.test/x ")).toEqual({
      ok: true,
      value: "https://community.example.test/x",
    });
  });

  it("rejects anything else with a plain message", () => {
    for (const bad of ["community.example.test", "javascript:alert(1)", "ftp://x.test/a", 42, null, undefined]) {
      const result = parseTutorialsUrlInput(bad);
      expect(result.ok).toBe(false);
    }
  });
});
