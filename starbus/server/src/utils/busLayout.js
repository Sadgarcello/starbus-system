/**
 * 46-seat coach layout (top-down). Front = index 0.
 * Matches common Sudan coach numbering: pairs left/right with aisle center.
 */
export const BUS46_TOTAL_SEATS = 46;

/** @type {{ left: number[]; right: number[] }[]} */
export const BUS46_ROWS = [
  { left: [1, 2], right: [3, 4] },
  { left: [5, 6], right: [7, 8] },
  { left: [9, 10], right: [11, 12] },
  { left: [13, 14], right: [15, 16] },
  { left: [17, 18], right: [19, 20] },
  { left: [21, 22], right: [23, 24] },
  { left: [25, 26], right: [29, 30] },
  { left: [27, 28], right: [33, 34] },
  { left: [31, 32], right: [37, 38] },
  { left: [35, 36], right: [41, 42] },
  { left: [39, 40], right: [45, 46] },
  { left: [43, 44], right: [] },
];
