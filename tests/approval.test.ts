import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { approvalDestination, keepProfileFlags } from "@/lib/approval";

describe("approval gate", () => {
  const waiting = { approved: false, isAdmin: false };
  const grower = { approved: true, isAdmin: false };
  const admin = { approved: true, isAdmin: true };

  it("holds an unapproved person on the waiting page", () => {
    expect(approvalDestination("/flowers", waiting)).toBe("waiting");
    expect(approvalDestination("/flowers/farms/new", waiting)).toBe("waiting");
    expect(approvalDestination("/veg", waiting)).toBe("waiting");
    expect(approvalDestination("/veg/plan", waiting)).toBe("waiting");
    expect(approvalDestination("/settings", waiting)).toBe("waiting");
    expect(approvalDestination("/admin", waiting)).toBe("waiting");
    expect(approvalDestination("/waiting", waiting)).toBe("allow");
    expect(approvalDestination("/", waiting)).toBe("allow");
  });

  it("lets an approved grower into their sections and not the admin list", () => {
    expect(approvalDestination("/flowers", grower)).toBe("allow");
    expect(approvalDestination("/veg/tasks", grower)).toBe("allow");
    expect(approvalDestination("/admin", grower)).toBe("home");
    expect(approvalDestination("/waiting", grower)).toBe("home");
  });

  it("lets an admin open the approval list", () => {
    expect(approvalDestination("/admin", admin)).toBe("allow");
  });

  it("stops a person changing their own approval or admin flag", () => {
    const previous = { approved: false, isAdmin: false, name: "Rowan" };
    const forged = { approved: true, isAdmin: true, name: "Rowan" };
    expect(keepProfileFlags(previous, forged, { isAdmin: false, isServiceRole: false })).toEqual(previous);
  });

  it("lets an admin change approval, and only the service role change is_admin", () => {
    const previous = { approved: false, isAdmin: false };
    const next = { approved: true, isAdmin: true };
    expect(keepProfileFlags(previous, next, { isAdmin: true, isServiceRole: false })).toEqual({
      approved: true,
      isAdmin: false,
    });
    expect(keepProfileFlags(previous, next, { isAdmin: false, isServiceRole: true })).toEqual(next);
  });

  it("locks the flags in the migration", () => {
    const sql = readFileSync(new URL("../supabase/migrations/20261126100000_profile_approval.sql", import.meta.url), "utf8");
    expect(sql).toContain("approved boolean not null default false");
    expect(sql).toContain("is_admin boolean not null default false");
    expect(sql).toContain("set approved = true");
    expect(sql).toContain("set is_admin = true");
    expect(sql).toContain("protect_profile_flags");
  });
});
