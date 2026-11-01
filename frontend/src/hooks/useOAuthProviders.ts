import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { getOAuthProviders } from '../services/oauthService';
import { OAuthProvidersResponse } from '../types/oauth';

export function useOAuthProviders() {
  return useQuery<OAuthProvidersResponse, Error>({
    queryKey: queryKeys.oauthProviders,
    queryFn: getOAuthProviders,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      // Do not retry 404 Not Found — endpoint does not exist
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: true,
  });
}

export default useOAuthProviders;
