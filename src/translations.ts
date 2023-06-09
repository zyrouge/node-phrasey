import { PhraseyContentFormatter } from "./contentFormats";
import { PhraseyError } from "./error";
import { PhraseyResult } from "./result";
import { PhraseySchema } from "./schema";
import {
    PhraseyTranslation,
    PhraseyTranslationStringValue,
} from "./translation";

export class PhraseyTranslations {
    all = new Map<string, PhraseyTranslation>();
    pathCodeMap: Record<string, string> = {};

    constructor(public schema: PhraseySchema) {}

    async load(
        path: string,
        formatter: PhraseyContentFormatter,
        globalFallback: string[]
    ): Promise<PhraseyResult<string, Error>> {
        const translation = await PhraseyTranslation.create(
            path,
            this.schema,
            formatter,
            globalFallback
        );
        if (!translation.success) return translation;
        const localeCode = translation.data.locale.code;
        this.all.set(localeCode, translation.data);
        this.pathCodeMap[path] = localeCode;
        return { success: true, data: localeCode };
    }

    ensure(translation: PhraseyTranslation): PhraseyResult<boolean, Error> {
        if (this.schema.keysCount() === translation.keysCount()) {
            return { success: true, data: true };
        }
        const fallback: PhraseyTranslation[] = [];
        for (const x of translation.fallback) {
            const locale = this.pathCodeMap[x];
            if (!locale) {
                return {
                    success: false,
                    error: new PhraseyError(
                        `Invalid translation file path "${x}"`
                    ),
                };
            }
            const resolved = this.all.get(locale);
            if (!resolved) {
                return {
                    success: false,
                    error: new PhraseyError(`Unknown translation "${locale}"`),
                };
            }
            fallback.push(resolved);
        }
        for (const x of this.schema.keys.values()) {
            if (translation.hasKey(x.name)) continue;
            const fallbackValue = PhraseyTranslations.resolveFallbackKey(
                fallback,
                x.name
            );
            switch (fallbackValue?.state) {
                case "set":
                case "fallback":
                    translation.setKey(x.name, {
                        state: "fallback",
                        parts: fallbackValue.parts,
                    });
                    break;

                default:
                    translation.setKey(x.name, {
                        state: "unset",
                    });
                    break;
            }
        }
        return { success: true, data: true };
    }

    values() {
        return this.all.values();
    }

    static resolveFallbackKey(
        translations: PhraseyTranslation[],
        key: string
    ): PhraseyTranslationStringValue | undefined {
        for (const x of translations) {
            const value = x.getKey(key);
            if (value) return value;
        }
        return;
    }
}
