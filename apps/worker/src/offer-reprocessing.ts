interface Derivation {
  id: string;
  rawMessageId: string;
  parseId: string | null;
  offerId: string;
  active: boolean;
}

export function planOfferReprocessing(input: {
  rawMessageId: string;
  currentParseId: string;
  mentions: Derivation[];
  snapshots: Derivation[];
}) {
  const priorMentions = input.mentions.filter(
    (item) =>
      item.rawMessageId === input.rawMessageId &&
      item.parseId !== input.currentParseId &&
      item.active
  );
  const priorSnapshots = input.snapshots.filter(
    (item) =>
      item.rawMessageId === input.rawMessageId &&
      item.parseId !== input.currentParseId &&
      item.active
  );
  return {
    mentionIdsToDeactivate: priorMentions.map((item) => item.id),
    snapshotIdsToSupersede: priorSnapshots.map((item) => item.id),
    affectedOfferIds: Array.from(
      new Set([...priorMentions, ...priorSnapshots].map((item) => item.offerId))
    ).sort()
  };
}
