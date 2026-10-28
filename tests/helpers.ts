import { MemoryProjectStorage } from "../src/core/memory-storage.js";
import { WorkspaceService } from "../src/application/workspace-service.js";
import type { ProjectStorage } from "../src/core/storage.js";

export function createTestService(storage: ProjectStorage = new MemoryProjectStorage()) {
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  const service = new WorkspaceService(storage, now);
  return { storage, service };
}

export async function createProjectWithService(service: WorkspaceService, title = "Proyecto de prueba") {
  return service.createProject({ title });
}