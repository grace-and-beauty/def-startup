/**
 * A card started in the builder on the home page and carried through /login
 * to the onboarding wizard as query parameters:
 * ?niche=…&stamps=…&reward=…&label=…&name=…&bg=…&fg=…&lb=… (only the niche
 * is required).
 * Invalid values are dropped; the wizard and the server validate again.
 */
import { isNicheSlug, OTHER_NICHE, type NicheSlug } from "@/config/niches";

import {
  businessNameSchema,
  hexColorSchema,
  nicheLabelSchema,
  rewardTextSchema,
  stampsRequiredSchema,
} from "./business-input";

export interface CardDraft {
  niche: NicheSlug;
  stampsRequired?: number;
  rewardText?: string;
  /** Only with «Інше». */
  nicheLabel?: string;
  businessName?: string;
  /** All three or none. */
  colors?: { bg: string; fg: string; label: string };
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function param(params: Params, key: string): string | undefined {
  const value = params instanceof URLSearchParams ? (params.get(key) ?? undefined) : params[key];
  return typeof value === "string" ? value : undefined;
}

export function parseCardDraft(params: Params): CardDraft | null {
  const niche = param(params, "niche");
  if (!niche || !isNicheSlug(niche)) return null;
  const draft: CardDraft = { niche };
  const stamps = param(params, "stamps");
  const parsedStamps = stamps === undefined ? null : stampsRequiredSchema.safeParse(stamps);
  if (parsedStamps?.success) draft.stampsRequired = parsedStamps.data;
  const reward = rewardTextSchema.safeParse(param(params, "reward"));
  if (reward.success) draft.rewardText = reward.data;
  if (niche === OTHER_NICHE) {
    const label = nicheLabelSchema.safeParse(param(params, "label"));
    if (label.success) draft.nicheLabel = label.data;
  }
  const name = businessNameSchema.safeParse(param(params, "name"));
  if (name.success) draft.businessName = name.data;
  const [bg, fg, label] = ["bg", "fg", "lb"].map((key) => hexColorSchema.safeParse(param(params, key)));
  if (bg!.success && fg!.success && label!.success) draft.colors = { bg: bg!.data, fg: fg!.data, label: label!.data };
  return draft;
}

/**
 * Where an owner continues after signing in with a draft (the hidden "draft"
 * field of /login): the wizard with the card filled in, or null.
 */
export function onboardingPathForDraft(query: string | undefined): string | null {
  const draft = query ? parseCardDraft(new URLSearchParams(query)) : null;
  return draft ? `/dashboard/onboarding?${cardDraftQuery(draft)}` : null;
}

/** The draft as a query string (without "?"). */
export function cardDraftQuery(draft: CardDraft): string {
  const query = new URLSearchParams({ niche: draft.niche });
  if (draft.stampsRequired !== undefined) query.set("stamps", String(draft.stampsRequired));
  if (draft.rewardText) query.set("reward", draft.rewardText);
  if (draft.nicheLabel) query.set("label", draft.nicheLabel);
  if (draft.businessName) query.set("name", draft.businessName);
  if (draft.colors) {
    query.set("bg", draft.colors.bg);
    query.set("fg", draft.colors.fg);
    query.set("lb", draft.colors.label);
  }
  return query.toString();
}
