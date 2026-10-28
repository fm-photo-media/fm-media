// SEC-26: JSON for an inline <script type="application/ld+json">. Escapes the characters
// that could close the tag or end a line in a script (<, >, &, U+2028, U+2029) as \uXXXX
// sequences, so the output is still the same JSON but can never break out of the element.
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(UNSAFE, (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}
