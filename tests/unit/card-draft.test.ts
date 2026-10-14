import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";
import { cardDraftQuery, onboardingPathForDraft, parseCardDraft, type CardDraft } from "@/lib/domain/card-draft";

describe("card draft (builder → login → wizard)", () => {
  it("round-trips through the query string", () => {
    const draft: CardDraft = {
      niche: "inshe",
      stampsRequired: 9,
      rewardText: "Кальян у подарунок на 9-й візит",
      nicheLabel: "Кальянна",
      businessName: "Дим & Co",
      colors: { bg: "#5b21b6", fg: "#faf5ff", label: "#c4b5fd" },
    };
    expect(parseCardDraft(new URLSearchParams(cardDraftQuery(draft)))).toEqual(draft);
  });

  it("reads a plain ?niche= from /dlya pages", () => {
    expect(parseCardDraft({ niche: "barbershop" })).toEqual({ niche: "barbershop" });
    expect(cardDraftQuery({ niche: "barbershop" })).toBe("niche=barbershop");
  });

  it("needs a known niche", () => {
    expect(parseCardDraft({})).toBeNull();
    expect(parseCardDraft({ niche: "casino" })).toBeNull();
    expect(parseCardDraft({ niche: ["barbershop", "kafe"] })).toBeNull();
  });

  it("drops invalid values instead of trusting them", () => {
    const draft = parseCardDraft({
      niche: "kafe",
      stamps: "50",
      reward: " ",
      name: "x".repeat(81),
      bg: "#5b21b6",
      fg: "red",
      lb: "#c4b5fd",
    });
    expect(draft).toEqual({ niche: "kafe" });
    expect(parseCardDraft({ niche: "kafe", stamps: "1" })).toEqual({ niche: "kafe" });
    expect(parseCardDraft({ niche: "kafe", stamps: "abc" })).toEqual({ niche: "kafe" });
  });

  it("keeps the own category only with «Інше»", () => {
    expect(parseCardDraft({ niche: "kafe", label: "Кальянна" })).toEqual({ niche: "kafe" });
    expect(parseCardDraft({ niche: "inshe", label: "  Книгарня " })).toEqual({ niche: "inshe", nicheLabel: "Книгарня" });
    expect(parseCardDraft({ niche: "inshe", label: "К" })).toEqual({ niche: "inshe" });
  });

  it("sends the owner to the wizard after sign-in, surviving the redirect check", () => {
    const query = cardDraftQuery({ niche: "inshe", stampsRequired: 7, rewardText: "Кава & десерт", nicheLabel: "Кальянна" });
    const path = onboardingPathForDraft(query);
    expect(path).toBe(`/dashboard/onboarding?${query}`);
    expect(safeNextPath(path)).toBe(path);
    expect(onboardingPathForDraft(undefined)).toBeNull();
    expect(onboardingPathForDraft("niche=casino")).toBeNull();
  });

  it("trims the reward and keeps stamps in 2–20", () => {
    expect(parseCardDraft({ niche: "tatu", stamps: "20", reward: "  Знижка 20%  " })).toEqual({
      niche: "tatu",
      stampsRequired: 20,
      rewardText: "Знижка 20%",
    });
  });
});
