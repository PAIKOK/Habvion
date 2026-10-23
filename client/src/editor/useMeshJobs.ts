import { useEffect } from "react";
import type { FurnitureItem, HomeDesign } from "@shared/types/home";
import { api } from "../api/client";
import { useDesignStore } from "../state/designStore";

const EVERY_MS = 4000;

/**
 * Poll the 3D model jobs of this design's imported items. The item is placeable and drawn
 * from its shape the whole time; a finished model only changes how it looks.
 */
export function useMeshJobs(design: HomeDesign | null) {
  const pending = (design?.customItems ?? []).filter((i) => i.meshJob?.status === "pending").map((i) => `${i.id}:${i.meshJob!.id}`).join(",");
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    const tick = async () => {
      for (const pair of pending.split(",")) {
        const [itemId, jobId] = pair.split(":") as [string, string];
        try {
          const r = await api<{ job: NonNullable<FurnitureItem["meshJob"]>; modelUrl: string | null }>(`/imports/mesh/${encodeURIComponent(jobId)}`);
          if (stopped || r.job.status === "pending") continue;
          useDesignStore.getState().dispatch({ type: "custom-item/set-model", id: itemId, patch: { meshJob: r.job, ...(r.modelUrl ? { modelUrl: r.modelUrl } : {}) } });
        } catch (e) {
          // Jobs live in server memory: after a restart the job is gone, so stop asking.
          if (!stopped && (e as { status?: number }).status === 404)
            useDesignStore.getState().dispatch({ type: "custom-item/set-model", id: itemId, patch: { meshJob: { id: jobId, status: "failed", error: "The 3D model job was lost. Import the item again to retry." } } });
        }
      }
    };
    const timer = setInterval(() => void tick(), EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pending]);
}
