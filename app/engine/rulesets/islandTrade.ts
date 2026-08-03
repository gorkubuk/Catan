import type { Ruleset } from "../ruleset/types";

/**
 * First concrete ruleset for this project: a Catan-mechanic game with our
 * own names throughout (see project terminology table). Nothing here is
 * read by the engine core directly by name — this is just data passed in.
 */
export const islandTradeRuleset: Ruleset = {
  id: "island-trade",
  displayName: "Island Trade",
  minPlayers: 3,
  maxPlayers: 4,

  resources: [
    { id: "timber", displayName: "Timber" },
    { id: "clay", displayName: "Clay" },
    { id: "wool", displayName: "Wool" },
    { id: "grain", displayName: "Grain" },
    { id: "stone", displayName: "Stone" },
  ],

  board: {
    radius: 2,
    tileTypes: [
      { id: "forest", displayName: "Forest", resourceId: "timber", count: 4 },
      { id: "pasture", displayName: "Pasture", resourceId: "wool", count: 4 },
      { id: "field", displayName: "Field", resourceId: "grain", count: 4 },
      { id: "hill", displayName: "Hill", resourceId: "clay", count: 3 },
      { id: "mountain", displayName: "Mountain", resourceId: "stone", count: 3 },
      { id: "wasteland", displayName: "Wasteland", resourceId: null, count: 1 },
    ],
    numberTokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  },

  buildings: [
    {
      id: "road",
      displayName: "Road",
      cost: [
        { resourceId: "timber", amount: 1 },
        { resourceId: "clay", amount: 1 },
      ],
      victoryPoints: 0,
      maxPerPlayer: 15,
    },
    {
      id: "settlement",
      displayName: "Settlement",
      cost: [
        { resourceId: "timber", amount: 1 },
        { resourceId: "clay", amount: 1 },
        { resourceId: "wool", amount: 1 },
        { resourceId: "grain", amount: 1 },
      ],
      victoryPoints: 1,
      maxPerPlayer: 5,
    },
    {
      id: "city",
      displayName: "City",
      cost: [
        { resourceId: "grain", amount: 2 },
        { resourceId: "stone", amount: 3 },
      ],
      victoryPoints: 2,
      maxPerPlayer: 4,
    },
  ],

  developmentCards: [
    { id: "soldier", displayName: "Soldier Card", count: 14, victoryPoints: 0 },
    { id: "trade-monopoly", displayName: "Trade Monopoly Card", count: 2, victoryPoints: 0 },
    { id: "path-builder", displayName: "Path Builder Card", count: 2, victoryPoints: 0 },
    { id: "harvest", displayName: "Harvest Card", count: 2, victoryPoints: 0 },
    { id: "merit", displayName: "Merit Card", count: 5, victoryPoints: 1 },
  ],

  dice: {
    diceCount: 2,
    sides: 6,
  },

  blockerMechanic: {
    enabled: true,
    displayName: "Raider",
    triggerOnRollTotal: 7,
  },

  bonusBadges: [
    { id: "trailblazer", displayName: "Trailblazer Badge", victoryPoints: 2, minimumToQualify: 5 },
    { id: "vanguard", displayName: "Vanguard Badge", victoryPoints: 2, minimumToQualify: 3 },
  ],

  winCondition: {
    targetVictoryPoints: 10,
  },
};
