/**
 * Preferences that belong to the device, not to the person's health data: the UI language and the appearance.
 * They live at the top level of the stored data (appearance used to live only on the profile, which "Erase
 * everything" deletes) so that resetting the data does not send the app back to System language and System look.
 */
import type { AppData, Appearance } from './types';

/** The appearance in effect: the top-level preference, else the one saved on an older profile, else System. */
export function appearanceOf(data: Pick<AppData, 'appearance' | 'profile'>): Appearance {
  return data.appearance ?? data.profile?.appearance ?? 'system';
}

/** What survives a reset: language and appearance, only when they were actually chosen. */
export function preferencesToKeep(data: AppData): Pick<AppData, 'language' | 'appearance'> {
  const kept: Pick<AppData, 'language' | 'appearance'> = {};
  if (data.language) kept.language = data.language;
  const appearance = appearanceOf(data);
  if (data.appearance || data.profile?.appearance) kept.appearance = appearance;
  return kept;
}

/** A new appearance choice, written to the top level and to the profile (older builds read it there). */
export function withAppearance(data: AppData, appearance: Appearance): AppData {
  return { ...data, appearance, profile: data.profile ? { ...data.profile, appearance } : null };
}
