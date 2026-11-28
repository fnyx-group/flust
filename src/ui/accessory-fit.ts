export type AccessoryFit = {
  // The width of the row, inside its padding.
  readonly row: number;
  // The widths of what else shares the row with the text, such as an icon and the switch.
  readonly others: readonly number[];
  readonly accessory: number;
  readonly gap: number;
  // The longest word of the row's texts, on one line.
  readonly widestWord: number;
};

// Whether an accessory, such as a time chip, stays beside the text of a row: only while the text
// keeps room for its longest word, so that no word breaks inside, at any text and display size.
export function accessoryBeside({
  row,
  others,
  accessory,
  gap,
  widestWord,
}: AccessoryFit): boolean {
  const gaps = (others.length + 1) * gap;
  const taken = others.reduce((sum, width) => sum + width, 0) + accessory + gaps;
  return row - taken >= widestWord;
}
