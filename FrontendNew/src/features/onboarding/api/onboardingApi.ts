import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/api/axiosInstance";

type QueryResult<T> = { data: T | undefined; isLoading: boolean; refetch: () => Promise<void> };

function useQuery<T>(url: string): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(url);
      setData(res.data as T);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { data, isLoading, refetch };
}

export interface ProcessingQueueItem {
  id: string | number;
  organisation_name: string;
  status: string;
  created_at: string;
}

export interface ProcessingQueue {
  items: ProcessingQueueItem[];
}

export function useGetOnboardingProcessingQueueQuery() {
  return useQuery<ProcessingQueue>("/onboarding/processing-queue");
}
