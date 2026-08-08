import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh enough, but always refetch on mount in local/tunnel flows.
        // refetchOnMount:false + dehydrated "pending" queries caused infinite loaders
        // with zero /api/trpc hits in Telegram WebView.
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        retry: 1,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        // Do NOT dehydrate pending queries — client would wait forever with no network.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query),
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
