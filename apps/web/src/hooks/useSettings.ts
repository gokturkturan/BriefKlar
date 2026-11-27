import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  isExplanationLanguage,
  type ExplanationLanguage,
  type SettingsDto,
  type UpdateSettingsInput,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";

export function useSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: api.getSettings, staleTime: Infinity });

  const update = useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.updateSettings(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<SettingsDto>(queryKeys.settings);
      if (previous) queryClient.setQueryData<SettingsDto>(queryKeys.settings, { ...previous, ...input });
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.settings, context.previous);
    },
    onSuccess: (saved, input) => {
      queryClient.setQueryData(queryKeys.settings, saved);
      // A new state can move due dates of every letter
      if ("state" in input) void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });

  return { settings, update };
}

/** Changes the language of the whole site, stored in the user's settings */
export function useChangeLanguage(): (value: string) => void {
  const { settings, update } = useSettings();
  return (value: string) => {
    if (isExplanationLanguage(value) && value !== settings.data?.preferredLanguage) {
      update.mutate({ preferredLanguage: value });
    }
  };
}

/**
 * Language for one panel (explanation, reply translation): the site language unless the user
 * picks another one there. Picking one there does not change the site language.
 */
export function usePanelLanguage(siteLanguage: ExplanationLanguage): [ExplanationLanguage, (value: string) => void] {
  const [picked, setPicked] = useState<ExplanationLanguage | null>(null);
  const change = (value: string) => {
    if (isExplanationLanguage(value)) setPicked(value === siteLanguage ? null : value);
  };
  return [picked ?? siteLanguage, change];
}
