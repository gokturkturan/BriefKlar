import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AccountDto, LoginInput, RegisterInput } from "@briefklar/shared";
import { api, ApiError, queryKeys } from "../api/client";

/** The signed-in account; null when nobody is signed in */
export function useAccount() {
  return useQuery({
    queryKey: queryKeys.account,
    queryFn: () =>
      api.getAccount().catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    staleTime: Infinity,
  });
}

/**
 * Nothing cached for an earlier account is kept. The account query itself stays (with the new
 * value), so the components that watch it render again.
 */
export function switchAccount(queryClient: QueryClient, account: AccountDto | null) {
  queryClient.setQueryData<AccountDto | null>(queryKeys.account, account);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.account[0] });
}

/** Signs in or creates an account */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode: "login"; data: LoginInput } | { mode: "register"; data: RegisterInput }) =>
      input.mode === "login" ? api.login(input.data) : api.register(input.data),
    onSuccess: (account) => switchAccount(queryClient, account),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => switchAccount(queryClient, null),
  });
}
