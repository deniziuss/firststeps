import type { Dependency } from "./prerequisites";
import type { AccommodationCondition, ApplicableProgram } from "./statuses";

// Returns the chain that would close a cycle if `taskId` started requiring `requiredTaskId`,
// e.g. [requiredTaskId, ..., taskId], or null when the edge is safe.
export function findCycle(dependencies: Dependency[], taskId: number, requiredTaskId: number): number[] | null {
  if (taskId === requiredTaskId) return [taskId];

  const requires = new Map<number, number[]>();
  for (const d of dependencies) {
    requires.set(d.taskId, [...(requires.get(d.taskId) ?? []), d.requiredTaskId]);
  }

  // Walk the prerequisites of requiredTaskId; reaching taskId means taskId is already upstream.
  const visited = new Set<number>();
  const stack: { id: number; path: number[] }[] = [{ id: requiredTaskId, path: [requiredTaskId] }];
  while (stack.length > 0) {
    const { id, path } = stack.pop()!;
    if (id === taskId) return path;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of requires.get(id) ?? []) stack.push({ id: next, path: [...path, next] });
  }
  return null;
}

type Applicability = {
  universityId: number | null;
  applicableProgram: ApplicableProgram;
  accommodationCondition: AccommodationCondition;
};

export type ApplicabilityGap =
  | { kind: "scope" }
  | { kind: "programme"; value: ApplicableProgram }
  | { kind: "accommodation"; value: AccommodationCondition };

// Lists why some journeys could contain the dependent task without its prerequisite.
// Such a dependency would leave the dependent permanently locked there (Issue 001).
export function applicabilityGaps(dependent: Applicability, prerequisite: Applicability): ApplicabilityGap[] {
  const gaps: ApplicabilityGap[] = [];
  if (prerequisite.universityId !== null && prerequisite.universityId !== dependent.universityId) {
    gaps.push({ kind: "scope" });
  }
  if (prerequisite.applicableProgram !== "All" && prerequisite.applicableProgram !== dependent.applicableProgram) {
    gaps.push({ kind: "programme", value: prerequisite.applicableProgram });
  }
  if (prerequisite.accommodationCondition !== "Any" && prerequisite.accommodationCondition !== dependent.accommodationCondition) {
    gaps.push({ kind: "accommodation", value: prerequisite.accommodationCondition });
  }
  return gaps;
}
