import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ApiError, queryKeys } from "./api/client";
import { App } from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import "./index.css";

/** A 401 means the session has ended (expired, or signed out elsewhere): show the sign-in page */
function onError(err: Error) {
  if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(queryKeys.account, null);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
