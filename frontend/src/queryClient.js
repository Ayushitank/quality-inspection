import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/http.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // the default 'online' mode pauses requests offline instead of failing them
      networkMode: 'always',
      staleTime: 15_000,
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
    mutations: { networkMode: 'always', retry: false },
  },
});
