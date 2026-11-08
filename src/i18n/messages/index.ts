import type { Locale } from "../config";
import { en, type Messages } from "./en";
import { tr } from "./tr";

export const MESSAGES: Record<Locale, Messages> = { en, tr };
