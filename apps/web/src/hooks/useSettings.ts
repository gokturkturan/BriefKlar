import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** The language the user reads explanations and translations in, stored in their settings */
export function usePreferredLanguage(): [ExplanationLanguage, (value: string) => void] {
  const { settings, update } = useSettings();
  const language = settings.data?.preferredLanguage ?? "en";
  const change = (value: string) => {
    if (isExplanationLanguage(value) && value !== language) update.mutate({ preferredLanguage: value });
  };
  return [language, change];
}
