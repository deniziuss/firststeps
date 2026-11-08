import { describe, expect, it } from "vitest";
import { selectApplicableTemplates, type TemplateRule } from "@/domain/journeyEngine";

const RTU = 1;
const OTHER_UNI = 2;

const templates: TemplateRule[] = [
  { taskId: 1, universityId: null, applicableProgram: "All", accommodationCondition: "Any", isActive: true },
  { taskId: 2, universityId: RTU, applicableProgram: "Erasmus", accommodationCondition: "Any", isActive: true },
  { taskId: 3, universityId: RTU, applicableProgram: "FullTime", accommodationCondition: "Any", isActive: true },
  { taskId: 4, universityId: RTU, applicableProgram: "All", accommodationCondition: "NotArranged", isActive: true },
  { taskId: 5, universityId: RTU, applicableProgram: "All", accommodationCondition: "Confirmed", isActive: true },
  { taskId: 6, universityId: OTHER_UNI, applicableProgram: "All", accommodationCondition: "Any", isActive: true },
  { taskId: 7, universityId: RTU, applicableProgram: "All", accommodationCondition: "Any", isActive: false },
];

const ids = (list: TemplateRule[]) => list.map((t) => t.taskId);

describe("selectApplicableTemplates", () => {
  it("assigns Erasmus tasks and the NotArranged housing task", () => {
    const result = selectApplicableTemplates(templates, { universityId: RTU, programType: "Erasmus", accommodationStatus: "NotArranged" });
    expect(ids(result)).toEqual([1, 2, 4]);
  });

  it("assigns FullTime tasks and the Confirmed housing task", () => {
    const result = selectApplicableTemplates(templates, { universityId: RTU, programType: "FullTime", accommodationStatus: "Confirmed" });
    expect(ids(result)).toEqual([1, 3, 5]);
  });

  it("never includes inactive templates or another university's templates", () => {
    const result = selectApplicableTemplates(templates, { universityId: RTU, programType: "Other", accommodationStatus: "Confirmed" });
    expect(ids(result)).not.toContain(6);
    expect(ids(result)).not.toContain(7);
  });

  it("keeps global templates for any university", () => {
    const result = selectApplicableTemplates(templates, { universityId: OTHER_UNI, programType: "Other", accommodationStatus: "NotArranged" });
    expect(ids(result)).toEqual([1, 6]);
  });
});
