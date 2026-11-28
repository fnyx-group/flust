import { accessoryBeside } from '@/ui/accessory-fit';

// The check-in reminder row: its icon tile, the switch and the time chip, 16 points apart.
const checkIn = { others: [36, 52], accessory: 80, gap: 16 };

describe('accessoryBeside', () => {
  it('keeps the chip beside the text while its longest word fits', () => {
    expect(accessoryBeside({ ...checkIn, row: 296, widestWord: 80 })).toBe(true);
  });

  it('moves it under the text when the longest word would break', () => {
    expect(accessoryBeside({ ...checkIn, row: 296, widestWord: 80.5 })).toBe(false);
  });

  it('counts a gap between each part of the row', () => {
    expect(
      accessoryBeside({ row: 200, others: [52], accessory: 80, gap: 16, widestWord: 36 }),
    ).toBe(true);
    expect(
      accessoryBeside({ row: 200, others: [52], accessory: 80, gap: 16, widestWord: 37 }),
    ).toBe(false);
  });
});
