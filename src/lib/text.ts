// SEC-18: CR, LF, the Unicode line and paragraph separators (U+2028, U+2029), tabs and
// other control characters collapse to one space, then the result is trimmed.
const SEPARATORS = String.fromCharCode(0x2028, 0x2029);
const CONTROL_RUN = new RegExp(`[\x00-\x1f\x7f-\x9f${SEPARATORS}]+`, "g");

export function singleLine(value: string) {
  return value.replace(CONTROL_RUN, " ").replace(/ {2,}/g, " ").trim();
}
