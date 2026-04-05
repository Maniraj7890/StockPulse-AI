import { analyzeStructureLayer } from '@/utils/predictionEngine';

export { analyzeStructureLayer };

export function buildStructureSnapshot(input = {}) {
  const structure = analyzeStructureLayer(input);
  return {
    structureBias: structure.structureBias,
    structureStrength: structure.structureStrength,
    structureReason: structure.reason,
    supportLevel: structure.supportLevel,
    resistanceLevel: structure.resistanceLevel,
    supportDistancePercent: structure.supportDistancePercent,
    resistanceDistancePercent: structure.resistanceDistancePercent,
    breakoutRisk: structure.breakoutRisk,
    pullbackChance: structure.pullbackChance,
    summary: structure.summary,
  };
}
