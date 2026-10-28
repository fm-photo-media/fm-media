import { test } from "node:test";
import assert from "node:assert/strict";
import { adminPath, withParams } from "./admin-path";

test("returnTo accepts only same-site /admin paths", () => {
  assert.equal(adminPath("/admin?page=2&status=NEW", "/admin"), "/admin?page=2&status=NEW");
  assert.equal(adminPath("/admin/gallery", "/admin"), "/admin/gallery");
  for (const bad of ["https://evil.example/admin", "//evil.example/admin", "/admin//evil", "/administrator", "/\evil", "", null, "/contact"]) {
    assert.equal(adminPath(bad, "/admin"), "/admin", String(bad));
  }
});

test("notice params are replaced, other params kept", () => {
  assert.equal(withParams("/admin?page=2&error=confirm-delete", { success: "inquiry-deleted" }), "/admin?page=2&success=inquiry-deleted");
  assert.equal(withParams("/admin/login", { error: "rate-limited", wait: "12" }), "/admin/login?error=rate-limited&wait=12");
});

test("SEC-22: the OUTPUT is checked, so tab/newline/dot-segment tricks can't make //host", () => {
  const probes = [
    "/admin/../\t/evil.com",
    "/admin/../\n/evil.com",
    "/admin/../\r/evil.com",
    "/admin/%2e%2e/\t/evil.com",
    "/admin/%2E%2E/\n/evil.com",
    "/admin/..\t/\t/evil.com",
    "/admin/../\t\evil.com",
    "/admin/../evil",
    "/admin/../contact",
    "/admin/%2e%2e",
    "/admin\t/../\t/evil.com"
  ];
  for (const probe of probes) {
    const out = adminPath(probe, "/admin");
    assert.equal(out, "/admin", JSON.stringify(probe));
  }
});

test("SEC-22: every accepted result is a single-slash path under /admin", () => {
  const inputs = ["/admin", "/admin/", "/admin/gallery/abc?x=1", "/admin?page=2", "/admin/gallery/./abc", "/admin/x/../gallery"];
  for (const input of inputs) {
    const out = adminPath(input, "/admin");
    assert.match(out, /^\/admin(?:[/?]|$)/, input);
    assert.ok(out[1] !== "/" && out[1] !== "\\", input);
  }
  assert.equal(adminPath("/admin/x/../gallery", "/admin"), "/admin/gallery");
});
