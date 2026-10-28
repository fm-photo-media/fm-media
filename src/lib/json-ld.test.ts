import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLd } from "./json-ld";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const BS = "\\";

// SEC-26: the JSON-LD script body can never close its <script> tag or break a line.
test("serializeJsonLd escapes </script>, <, >, & and U+2028/U+2029", () => {
  const data = { a: "</script><script>alert(1)</script>", b: "x & y > z", c: `l${LS}p${PS}` };
  const out = serializeJsonLd(data);
  assert.ok(!out.includes("<") && !out.includes(">") && !out.includes("&"), out);
  assert.ok(!out.includes(LS) && !out.includes(PS));
  // The six-character sequence backslash-u-0-0-3-c, not the "<" character itself.
  assert.ok(out.includes(`${BS}u003c/script${BS}u003e`), out);
  assert.ok(out.includes(`${BS}u0026`) && out.includes(`${BS}u2028`) && out.includes(`${BS}u2029`), out);
  // Still valid JSON that round-trips to the same data.
  assert.deepEqual(JSON.parse(out), data);
});
