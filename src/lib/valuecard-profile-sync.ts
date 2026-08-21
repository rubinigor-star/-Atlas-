export type AtlasValueCardProfile = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  cellPhone?: string | null;
  birthDate?: Date | string | null;
  city?: string | null;
  gender?: "MALE" | "FEMALE" | null;
};

export type ExistingValueCardProfile = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  cellPhone?: string | null;
  birthDate?: Date | string | null;
  city?: string | null;
  gender?: "MALE" | "FEMALE" | null;
};

export type ValueCardProfilePatch = Partial<AtlasValueCardProfile>;

function text(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildMissingValueCardProfilePatch(
  existing: ExistingValueCardProfile,
  atlas: AtlasValueCardProfile,
): ValueCardProfilePatch {
  const patch: ValueCardProfilePatch = {};

  if (!text(existing.firstName) && text(atlas.firstName)) patch.firstName = text(atlas.firstName);
  if (!text(existing.lastName) && text(atlas.lastName)) patch.lastName = text(atlas.lastName);
  if (!text(existing.email) && text(atlas.email)) patch.email = text(atlas.email);
  if (!text(existing.cellPhone) && text(atlas.cellPhone)) patch.cellPhone = text(atlas.cellPhone);
  if (!dateValue(existing.birthDate) && dateValue(atlas.birthDate)) patch.birthDate = dateValue(atlas.birthDate);
  if (!text(existing.city) && text(atlas.city)) patch.city = text(atlas.city);
  if (!existing.gender && atlas.gender) patch.gender = atlas.gender;

  return patch;
}

export function hasValueCardProfilePatch(patch: ValueCardProfilePatch) {
  return Object.keys(patch).length > 0;
}
