import type { AccommodationCondition, AccommodationStatus, ApplicableProgram, ProgramType } from "./statuses";

export type TemplateRule = {
  taskId: number;
  universityId: number | null;
  applicableProgram: ApplicableProgram;
  accommodationCondition: AccommodationCondition;
  isActive: boolean;
};

export type JourneyProfile = {
  universityId: number;
  programType: ProgramType;
  accommodationStatus: AccommodationStatus;
};

// Same rule as dbo.usp_Journey_CreateWithTasks.
export function isTemplateApplicable(template: TemplateRule, profile: JourneyProfile): boolean {
  return (
    template.isActive &&
    (template.universityId === null || template.universityId === profile.universityId) &&
    (template.applicableProgram === "All" || template.applicableProgram === profile.programType) &&
    (template.accommodationCondition === "Any" || template.accommodationCondition === profile.accommodationStatus)
  );
}

export function selectApplicableTemplates<T extends TemplateRule>(templates: T[], profile: JourneyProfile): T[] {
  return templates.filter((template) => isTemplateApplicable(template, profile));
}
