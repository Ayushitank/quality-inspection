import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSummary, listInspections, resolveInspection } from '../api/inspections.js';
import { submitInspection } from '../offline/submitInspection.js';

export const inspectionKeys = {
  all: ['inspections'],
  list: (filters) => ['inspections', 'list', filters],
  summary: ['inspections', 'summary'],
};

export function useInspectionList(filters) {
  return useInfiniteQuery({
    queryKey: inspectionKeys.list(filters),
    queryFn: ({ pageParam }) => listInspections(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.page * meta.pageSize < meta.total ? meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useSummary() {
  return useQuery({ queryKey: inspectionKeys.summary, queryFn: getSummary });
}

export function useLogInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitInspection,
    onSuccess: (result) => {
      if (!result.queued) queryClient.invalidateQueries({ queryKey: inspectionKeys.all });
    },
  });
}

export function useResolveInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }) => resolveInspection(id, resolutionNote),
    onSettled: () => queryClient.invalidateQueries({ queryKey: inspectionKeys.all }),
  });
}
