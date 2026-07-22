import { describe, expect, it } from "vitest";
import { rolePermissions } from "./permissions";

describe("Atlas Office role templates",()=>{
  it("limits check-in staff to event viewing and scanning",()=>{expect(rolePermissions.CHECKIN).toEqual(["EVENT_VIEW","SCAN"])});
  it("allows approvers to review requests without managing events",()=>{expect(rolePermissions.APPROVER).toContain("REQUEST_REVIEW");expect(rolePermissions.APPROVER).not.toContain("EVENT_MANAGE")});
  it("gives the owner every permission",()=>{expect(new Set(rolePermissions.OWNER)).toEqual(new Set(rolePermissions.ADMIN))});
});
