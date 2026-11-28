export type SegmentFit = {
  readonly count: number;
  // The width inside the control's padding.
  readonly available: number;
  readonly gap: number;
  // The widest label on one line, with the padding of its segment.
  readonly widest: number;
};

// How many segments go on a row: all of them when every label fits whole, else rows of two, else
// one per row. A label never breaks inside a word, at any text and display size.
export function segmentColumns({ count, available, gap, widest }: SegmentFit): number {
  const candidates = count > 2 && count % 2 === 0 ? [count, 2, 1] : [count, 1];
  const fits = (columns: number) => (available - (columns - 1) * gap) / columns >= widest;
  return candidates.find(fits) ?? 1;
}
