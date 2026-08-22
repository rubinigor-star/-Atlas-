import { describe,expect,it } from "vitest";
import { getDictionary, localeConfig, resolveCommunicationLocale, resolvePlatformLocale, resolveStaffLocale } from "@/lib/i18n";

describe("locale context precedence",()=>{
  it("keeps platform, staff, event and transaction contexts independent",()=>{
    const platform=resolvePlatformLocale({savedPreference:"en",browserPreference:"he-IL"});
    const staff=resolveStaffLocale({memberOverride:"ru",organizationDefault:"he",devicePreference:"en"});
    const event=resolveCommunicationLocale({eventLocale:"he",platformLocale:platform});
    const order=resolveCommunicationLocale({transactionLocale:"he",eventLocale:"ru",platformLocale:platform});
    expect({platform,staff,event,order}).toEqual({platform:"en",staff:"ru",event:"he",order:"he"});
  });

  it("uses Israeli locale tags and full RTL for Hebrew",()=>{
    expect(localeConfig.ru.tag).toBe("ru-IL");
    expect(localeConfig.he).toMatchObject({tag:"he-IL",dir:"rtl",hypLanguage:"HEB"});
    expect(localeConfig.en.tag).toBe("en-IL");
  });

  it("keeps required dictionary sections in every locale",()=>{
    const keys=(value:Record<string,unknown>)=>Object.keys(value).sort();
    const ru=getDictionary("ru");
    for(const locale of ["he","en"] as const){
      const translated=getDictionary(locale);
      expect(keys(translated)).toEqual(keys(ru));
      for(const section of keys(ru)) expect(keys(translated[section as keyof typeof translated] as unknown as Record<string,unknown>)).toEqual(keys(ru[section as keyof typeof ru] as unknown as Record<string,unknown>));
    }
  });
});
