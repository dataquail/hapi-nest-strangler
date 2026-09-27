import type { UnitOfWork as UnitOfWorkPort } from "@org/unit-of-work";

// The boundary a write-side use case declares once: `return this.unitOfWork.run(async () => …)`.
export interface UnitOfWork extends UnitOfWorkPort {}
export abstract class UnitOfWork {}
