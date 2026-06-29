import {
  buildGhlSignupPayload,
  splitFullName,
} from "../ghl";

describe("splitFullName", () => {
  it("splits first and last name", () => {
    expect(splitFullName("Jane Smith")).toEqual({
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("handles single names", () => {
    expect(splitFullName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: "",
    });
  });

  it("handles multi-part last names", () => {
    expect(splitFullName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });
});

describe("buildGhlSignupPayload", () => {
  it("builds GHL-friendly payload with normalized email", () => {
    expect(
      buildGhlSignupPayload({
        email: "Jane@Business.COM",
        fullName: "Jane Smith",
      })
    ).toEqual({
      email: "jane@business.com",
      name: "Jane Smith",
      first_name: "Jane",
      last_name: "Smith",
      source: "MyProfitPulse App Signup",
    });
  });
});
