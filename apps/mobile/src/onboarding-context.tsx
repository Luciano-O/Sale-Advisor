import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { useApp } from "./app-context";
import { activeSubcategories, preselectedChoices, skipOnboarding } from "./preferences";
import type { LocalPreferences } from "./types";

interface OnboardingState {
  /** The choices so far; nothing is saved until the onboarding ends. */
  draft: LocalPreferences;
  update(change: (draft: LocalPreferences) => LocalPreferences): void;
  finish(): Promise<void>;
  skip(): Promise<void>;
}

const Context = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const { catalog, savePreferences } = useApp();
  const [draft, setDraft] = useState(() => preselectedChoices(activeSubcategories(catalog)));
  const finish = useCallback(
    () => savePreferences({ ...draft, onboardingCompleted: true }),
    [draft, savePreferences]
  );
  const skip = useCallback(() => savePreferences(skipOnboarding(draft)), [draft, savePreferences]);
  const value = useMemo(() => ({ draft, update: setDraft, finish, skip }), [draft, finish, skip]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOnboarding() {
  const value = useContext(Context);
  if (!value) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return value;
}
