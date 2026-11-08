"use client";

import { CheckIcon, LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  // The stored theme is only known in the browser; render a neutral state until then.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : "system";
  const Icon = current === "dark" ? MoonIcon : current === "light" ? SunIcon : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={withLabel ? "outline" : "ghost"} size={withLabel ? "default" : "icon"} aria-label={withLabel ? undefined : t("theme.change")}>
          <Icon aria-hidden />
          {withLabel && t(`theme.${current as "light" | "dark" | "system"}`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t("theme.light")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t("theme.dark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{t("theme.system")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Stores the choice in the language cookie (read by the proxy) and reloads the current page.
export function setLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  const [, first, ...rest] = window.location.pathname.split("/");
  const path = (LOCALES as readonly string[]).includes(first) ? `/${rest.join("/")}` : window.location.pathname;
  window.location.assign(path + window.location.search);
}

export function LanguageSwitcher({ withLabel = false }: { withLabel?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={withLabel ? "outline" : "ghost"} size={withLabel ? "default" : "sm"} aria-label={t("language.change")}>
          <LanguagesIcon aria-hidden />
          <span lang={locale}>{withLabel ? LOCALE_NAMES[locale] : locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        {LOCALES.map((option) => (
          <DropdownMenuItem key={option} lang={option} onSelect={() => option !== locale && setLocale(option)}>
            <CheckIcon className={option === locale ? "opacity-100" : "opacity-0"} aria-hidden />
            {LOCALE_NAMES[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
