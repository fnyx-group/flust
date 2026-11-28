import { segmentColumns } from '@/ui/segment-columns';

// The urge levels of the check-in: four segments, 4 points apart.
const urge = { count: 4, gap: 4 };

describe('segmentColumns', () => {
  it('keeps the four segments on one row while the widest label fits whole', () => {
    expect(segmentColumns({ ...urge, available: 340, widest: 82 })).toBe(4);
    expect(segmentColumns({ ...urge, available: 340, widest: 82.5 })).toBe(2);
  });

  it('puts them in two rows of two when four do not fit', () => {
    expect(segmentColumns({ ...urge, available: 280, widest: 120 })).toBe(2);
  });

  it('puts one per row when even two do not fit', () => {
    expect(segmentColumns({ ...urge, available: 280, widest: 139 })).toBe(1);
  });

  it('never makes rows of two for two or three segments', () => {
    expect(segmentColumns({ count: 2, gap: 4, available: 280, widest: 139 })).toBe(1);
    expect(segmentColumns({ count: 2, gap: 4, available: 280, widest: 138 })).toBe(2);
    expect(segmentColumns({ count: 3, gap: 4, available: 280, widest: 100 })).toBe(1);
  });
});
