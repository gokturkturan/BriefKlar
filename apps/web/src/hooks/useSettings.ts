import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  isExplanationLanguage,
  type ExplanationLanguage,
  type SettingsDto,
  type UpdateSettingsInput,
} from "@briefklar/shared";
import { api, queryKeys } from "../api/client";
import { useAccount } from "./useAccount";

/** The signed-in user's settings */
export function useSettings() {
  const queryClient = useQueryClient();
  const account = useAccount();
  const settings = useQuery({
    queryKey: queryKeys.settings,
    queryFn: api.getSettings,
    staleTime: Infinity,
    enabled: Boolean(account.data),
  });

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
