import { msg } from '../i18n/msg';
import type { Msg } from '../i18n/types';

export interface OnboardingProgress {
  step: number;
  hasSex: boolean;
  /** Age, height, weight and (optional) body fat all pass their checks. */
  bodyValid: boolean;
  underage: boolean;
  hasActivity: boolean;
  hasGoal: boolean;
}

/**
 * A one-line hint above Next that says what is still missing, shown before the user taps Next so the button
 * never looks dead. Null when the step is complete (or when the adults-only card already explains the stop).
 */
export function onboardingHint(progress: OnboardingProgress): Msg | null {
  if (progress.step === 1 && !progress.underage && !(progress.hasSex && progress.bodyValid)) return msg('onboarding.hint.body');
  if (progress.step === 2 && !progress.hasActivity) return msg('onboarding.hint.activity');
  if (progress.step === 3 && !progress.hasGoal) return msg('onboarding.hint.goal');
  return null;
}
