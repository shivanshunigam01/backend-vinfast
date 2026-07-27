import { describe, expect, it } from "vitest";
import {
  ACTION_LABELS,
  ADMIN_MODULES,
  actionToken,
  allActionTokensForModules,
  parseActionToken,
} from "@/lib/adminModules";
import {
  canPerformAction,
  canPerformManagerAction,
  getRestrictedModules,
  type AdminUser,
} from "@/lib/adminAuth";

function staff(partial: Partial<AdminUser>): AdminUser {
  return {
    name: "Test",
    email: "test@example.com",
    role: "executive",
    userType: "tdstaff",
    ...partial,
  };
}

describe("adminModules action catalog", () => {
  it("gives every module a view action first", () => {
    for (const mod of ADMIN_MODULES) {
      expect(mod.actions[0]).toBe("view");
      expect(mod.actions.length).toBeGreaterThan(0);
    }
  });

  it("labels every catalog action", () => {
    for (const mod of ADMIN_MODULES) {
      for (const action of mod.actions) {
        expect(ACTION_LABELS[action]).toBeTruthy();
      }
    }
  });

  it("builds and parses action tokens", () => {
    const token = actionToken("feedback_test_drive", "delete");
    expect(token).toBe("feedback_test_drive:delete");
    expect(parseActionToken(token)).toEqual({
      module: "feedback_test_drive",
      action: "delete",
    });
  });

  it("expands all tokens when enabling modules", () => {
    const tokens = allActionTokensForModules(["feedback_test_drive"]);
    expect(tokens).toContain("feedback_test_drive:view");
    expect(tokens).toContain("feedback_test_drive:delete");
  });
});

describe("canPerformAction / canPerformManagerAction", () => {
  it("allows admin portal users everything", () => {
    const user = staff({ userType: "admin", role: "superadmin", allowedModules: [] });
    expect(canPerformAction(user, "feedback_test_drive", "delete")).toBe(true);
  });

  it("unrestricted staff pass canPerformAction (role gates elsewhere)", () => {
    const user = staff({ role: "executive", allowedModules: [] });
    expect(getRestrictedModules(user)).toBeNull();
    expect(canPerformAction(user, "feedback_test_drive", "delete")).toBe(true);
    expect(canPerformManagerAction(user, "feedback_test_drive", "delete")).toBe(false);
  });

  it("unrestricted managers can delete via manager helper", () => {
    const user = staff({ role: "manager", allowedModules: [] });
    expect(canPerformManagerAction(user, "feedback_test_drive", "delete")).toBe(true);
  });

  it("custom ACL view-only cannot verify DL on my bookings", () => {
    const user = staff({
      role: "executive",
      allowedModules: ["td_my_bookings"],
      allowedActions: ["td_my_bookings:view"],
    });
    expect(canPerformAction(user, "td_my_bookings", "view")).toBe(true);
    expect(canPerformAction(user, "td_my_bookings", "verify_dl")).toBe(false);
    expect(canPerformAction(user, "td_my_bookings", "update")).toBe(false);
  });

  it("custom ACL with verify_dl can edit licence", () => {
    const user = staff({
      role: "executive",
      allowedModules: ["td_my_bookings"],
      allowedActions: ["td_my_bookings:view", "td_my_bookings:verify_dl"],
    });
    expect(canPerformAction(user, "td_my_bookings", "verify_dl")).toBe(true);
  });

  it("custom ACL view-only cannot delete feedback", () => {
    const user = staff({
      role: "executive",
      allowedModules: ["feedback_test_drive"],
      allowedActions: ["feedback_test_drive:view"],
    });
    expect(canPerformAction(user, "feedback_test_drive", "view")).toBe(true);
    expect(canPerformAction(user, "feedback_test_drive", "delete")).toBe(false);
    expect(canPerformManagerAction(user, "feedback_test_drive", "delete")).toBe(false);
  });

  it("custom ACL with delete can delete even as executive", () => {
    const user = staff({
      role: "executive",
      allowedModules: ["feedback_test_drive"],
      allowedActions: ["feedback_test_drive:view", "feedback_test_drive:delete"],
    });
    expect(canPerformAction(user, "feedback_test_drive", "delete")).toBe(true);
    expect(canPerformManagerAction(user, "feedback_test_drive", "delete")).toBe(true);
  });

  it("custom ACL without action list grants all actions on the module", () => {
    const user = staff({
      role: "executive",
      allowedModules: ["vehicle_stock"],
      allowedActions: [],
    });
    expect(canPerformAction(user, "vehicle_stock", "create")).toBe(true);
    expect(canPerformAction(user, "vehicle_stock", "delete")).toBe(true);
    expect(canPerformAction(user, "crm_leads", "view")).toBe(false);
  });
});
