"use client";

import { useActionState } from "react";
import { NativeSelect, SubmitButton } from "@/components/form";
import { USER_ROLES, type UserRole } from "@/domain/statuses";
import { saveUser } from "@/server/actions/admin";

export function UserForm({ userId, role, isActive }: { userId: number; role: UserRole; isActive: boolean }) {
  const [state, action] = useActionState(saveUser, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <NativeSelect name="role" defaultValue={role} aria-label="Role" className="w-28">
        {USER_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </NativeSelect>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="size-4 accent-primary" />
        Active
      </label>
      <SubmitButton size="sm" variant="secondary">
        Save
      </SubmitButton>
      {state && <span className={state.ok ? "text-xs text-success" : "text-xs text-destructive"}>{state.ok ? state.message : state.error}</span>}
    </form>
  );
}
