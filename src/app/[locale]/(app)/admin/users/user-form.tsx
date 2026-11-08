"use client";

import { useActionState } from "react";
import { NativeSelect, SubmitButton } from "@/components/form";
import { USER_ROLES, type UserRole } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { saveUser } from "@/server/actions/admin";

export function UserForm({ userId, name, role, isActive }: { userId: number; name: string; role: UserRole; isActive: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveUser, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <NativeSelect name="role" defaultValue={role} aria-label={`${t("admin.users.role")}: ${name}`} className="w-36">
        {USER_ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`roles.${r}`)}
          </option>
        ))}
      </NativeSelect>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="size-5 accent-primary" />
        {t("admin.users.active")}
      </label>
      <SubmitButton size="sm" variant="outline">
        {t("common.save")}
      </SubmitButton>
      {state && (
        <span role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  );
}
