import { afterEach, describe, expect, it, vi } from "vitest";

import { logEvent, scrub } from "@/lib/log";

describe("structured log", () => {
  afterEach(() => vi.restoreAllMocks());

  it("masks emails, phones and card tokens", () => {
    expect(scrub("owner pat@example.com called +380 50 111 22 33 about 7WVMGcXu4FLkfnfDhcRPQT")).toBe(
      "owner [email] called [phone] about [token]",
    );
  });

  it("writes one JSON line, keeps ids, reduces errors to a safe summary", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error('duplicate key (qr_token)=(DemoCard00000001) for +380501112233'), {
      code: "23505",
      details: "secret details",
    });
    logEvent("error", "card_issue_failed", { businessId: "00000000-0000-4000-8000-000000000101", error });
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      level: "error",
      event: "card_issue_failed",
      businessId: "00000000-0000-4000-8000-000000000101",
      error: { name: "Error", code: "23505", message: "duplicate key (qr_token)=([token]) for [phone]" },
    });
    expect(JSON.stringify(entry)).not.toContain("secret details");
  });
});
