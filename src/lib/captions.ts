// Legal R2 / QA-27 (batch 5a round 1): portfolio captions ("[Shoot], [Town]") never carry a
// street address. Shared by the server schema (validation.ts) and the admin form (no zod here).

export const CAPTION_MESSAGES = {
  shoot: "Name the shoot by the kind of home, with no numbers and no street name.",
  town: "Enter the town only, with no numbers and no street name."
} as const;

// Any decimal digit in any script (so full-width digits are caught too).
const ANY_DIGIT = new RegExp("\\p{Nd}", "u");

export const isSafeShootName = (value: string) => !ANY_DIGIT.test(value) && !value.startsWith("#");
export const isSafeTownName = (value: string) => !ANY_DIGIT.test(value);
