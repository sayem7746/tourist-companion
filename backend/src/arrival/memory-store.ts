import { ARRIVAL_CHECKLIST_SEED } from './content.js';
import {
  ARRIVAL_STAGES,
  type ArrivalAirportCode,
  type ArrivalChecklistStore,
  type ArrivalStage,
} from './types.js';

const stageRank = (stage: ArrivalStage): number => ARRIVAL_STAGES.indexOf(stage);

export function createMemoryArrivalStore(): ArrivalChecklistStore {
  const items = ARRIVAL_CHECKLIST_SEED.map((item) => ({ ...item }));

  return {
    async list(airportCode: ArrivalAirportCode, stage?: ArrivalStage) {
      return items
        .filter((item) => item.airportCode === airportCode && (stage === undefined || item.stage === stage))
        .sort(
          (a, b) =>
            stageRank(a.stage) - stageRank(b.stage) ||
            a.sortOrder - b.sortOrder ||
            a.id.localeCompare(b.id),
        );
    },
  };
}
