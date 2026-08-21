export type AtlasMemberProfile = {
  firstName?: string | null;
  lastName?: string | null;
  cellPhone?: string | null;
  email?: string | null;
  birthDate?: Date | string | null;
  city?: string | null;
  gender?: "MALE" | "FEMALE" | null;
};

type ValueCardCommon = {
  isError?: boolean | null;
  returnCode?: number | string | null;
  message?: string | null;
  printMessage?: string | null;
};

type ValueCardMemberDetails = {
  common?: ValueCardCommon;
  memberId?: number | string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDay?: string | null;
  cellPhone?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zipcode?: string | null;
  anniversaryDate?: string | null;
  gender?: number | string | null;
};

export type ValueCardEnrichmentResult = {
  updated: boolean;
  updatedFields: Array<"firstName" | "lastName" | "email" | "birthDate" | "city" | "gender">;
  memberId: number;
};

function bearer(token: string) {
  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJson(textValue: string): unknown {
  let value: unknown = textValue;
  for (let i = 0; i < 2; i += 1) {
    if (typeof value !== "string") break;
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"'))) break;
    try { value = JSON.parse(trimmed); } catch { break; }
  }
  return value;
}

function commonFrom(value: unknown): ValueCardCommon | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const common = (obj.common ?? obj.Common) as Record<string, unknown> | undefined;
  if (!common || typeof common !== "object") return null;
  return {
    isError: (common.isError ?? common.IsError) as boolean | null | undefined,
    returnCode: (common.returnCode ?? common.ReturnCode) as number | string | null | undefined,
    message: text(common.message ?? common.Message),
    printMessage: text(common.printMessage ?? common.PrintMessage),
  };
}

function normalizeDetails(value: unknown): ValueCardMemberDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const common = commonFrom(obj) ?? undefined;
  const memberIdRaw = obj.memberId ?? obj.MemberId ?? obj.memberID ?? obj.MemberID;
  const memberId = typeof memberIdRaw === "number" ? memberIdRaw : Number(memberIdRaw);
  if (!Number.isFinite(memberId) || memberId <= 0) return null;
  return {
    common,
    memberId,
    firstName: text(obj.firstName ?? obj.FirstName),
    lastName: text(obj.lastName ?? obj.LastName),
    birthDay: text(obj.birthDay ?? obj.BirthDay ?? obj.birthDate ?? obj.BirthDate),
    cellPhone: text(obj.cellPhone ?? obj.CellPhone),
    email: text(obj.email ?? obj.Email),
    phone: text(obj.phone ?? obj.Phone),
    address: text(obj.address ?? obj.Address),
    city: text(obj.city ?? obj.City),
    zipcode: text(obj.zipcode ?? obj.zipCode ?? obj.Zipcode ?? obj.ZipCode),
    anniversaryDate: text(obj.anniversaryDate ?? obj.AnniversaryDate),
    gender: (obj.gender ?? obj.Gender) as number | string | null | undefined,
  };
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function genderNumber(value: number | string | null | undefined) {
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  return 0;
}

async function valueCardFetch(token: string, url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization: bearer(token),
        Accept: "application/json, text/plain",
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getValueCardMemberDetails(token: string, memberId: number) {
  const url = new URL("https://valuecard.co.il/api/pos/club_member/ClubMemberDetails");
  url.searchParams.set("memberId", String(memberId));
  const response = await valueCardFetch(token, url.toString());
  const raw = await response.text();
  const parsed = raw ? parseJson(raw) : null;
  const common = commonFrom(parsed);
  if (!response.ok) throw new Error(`ValueCard member details HTTP ${response.status}`);
  if (common?.isError === true) throw new Error(String(common.printMessage || common.message || `ValueCard error ${common.returnCode ?? "unknown"}`));
  const details = normalizeDetails(parsed);
  if (!details) throw new Error("ValueCard member details response is missing memberId");
  return details;
}

export async function enrichValueCardMemberMissingFields(input: {
  token: string;
  memberId: number;
  atlas: AtlasMemberProfile;
}): Promise<ValueCardEnrichmentResult> {
  const current = await getValueCardMemberDetails(input.token, input.memberId);
  const atlasFirst = text(input.atlas.firstName);
  const atlasLast = text(input.atlas.lastName);
  const atlasPhone = text(input.atlas.cellPhone);
  const atlasEmail = text(input.atlas.email);
  const atlasBirth = dateOnly(input.atlas.birthDate);
  const atlasCity = text(input.atlas.city);
  const atlasGender = input.atlas.gender === "MALE" ? 1 : input.atlas.gender === "FEMALE" ? 2 : 0;

  const updatedFields: ValueCardEnrichmentResult["updatedFields"] = [];
  const firstName = text(current.firstName) || atlasFirst;
  const lastName = text(current.lastName) || atlasLast;
  const cellPhone = text(current.cellPhone) || atlasPhone;
  if (!text(current.firstName) && atlasFirst) updatedFields.push("firstName");
  if (!text(current.lastName) && atlasLast) updatedFields.push("lastName");
  if (!text(current.email) && atlasEmail) updatedFields.push("email");
  if (!dateOnly(current.birthDay) && atlasBirth) updatedFields.push("birthDate");
  if (!text(current.address) && !text(current.city) && atlasCity) updatedFields.push("city");
  if (genderNumber(current.gender) === 0 && atlasGender !== 0) updatedFields.push("gender");

  if (!updatedFields.length) return { updated: false, updatedFields, memberId: input.memberId };
  if (!firstName || !lastName || !cellPhone) throw new Error("ValueCard update requires firstName, lastName and cellPhone");

  const payload = {
    memberId: input.memberId,
    firstName,
    lastName,
    cellPhone,
    email: text(current.email) || atlasEmail || null,
    birthDay: dateOnly(current.birthDay) || atlasBirth || null,
    phone: text(current.phone),
    address: text(current.address) || text(current.city) || atlasCity || null,
    zipcode: text(current.zipcode),
    anniversaryDate: dateOnly(current.anniversaryDate),
    gender: genderNumber(current.gender) || atlasGender,
  };

  const response = await valueCardFetch(input.token, "https://valuecard.co.il/api/pos/club_member/UpdateClubMember", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  const parsed = raw ? parseJson(raw) : null;
  const common = commonFrom(parsed);
  if (!response.ok) throw new Error(`ValueCard member update HTTP ${response.status}`);
  if (common?.isError === true) throw new Error(String(common.printMessage || common.message || `ValueCard error ${common.returnCode ?? "unknown"}`));

  const verified = await getValueCardMemberDetails(input.token, input.memberId);
  const missingAfter = updatedFields.filter((field) => {
    if (field === "firstName") return !text(verified.firstName);
    if (field === "lastName") return !text(verified.lastName);
    if (field === "email") return !text(verified.email);
    if (field === "birthDate") return !dateOnly(verified.birthDay);
    if (field === "city") return !text(verified.address) && !text(verified.city);
    if (field === "gender") return genderNumber(verified.gender) === 0;
    return false;
  });
  if (missingAfter.length) throw new Error(`ValueCard update did not persist fields: ${missingAfter.join(",")}`);

  return { updated: true, updatedFields, memberId: input.memberId };
}
