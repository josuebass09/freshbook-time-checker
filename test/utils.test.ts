import { calculateLoggedHours, countWeekdays, getNoteValue, checkOOOStatus } from '../src/utils';

describe('Utils', () => {
  it('calculateLoggedHours converts seconds to hours', () => {
    expect(calculateLoggedHours(3600)).toBe(1);
    expect(calculateLoggedHours(14400)).toBe(4);
  });

  it('countWeekdays calculates weekdays correctly', () => {
    expect(countWeekdays('2025-09-01', '2025-09-30', true)).toBe(22);
      expect(countWeekdays('2025-08-01', '2025-08-31', true)).toBe(21);
    expect(countWeekdays('2025-01-01', '2025-01-01', false)).toBe(1);
  });

  it('getNoteValue extracts note from response', () => {
    const response = { time_entries: [{ note: 'Test note' }] };
    expect(getNoteValue(response)).toBe('Test note');
    expect(getNoteValue({})).toBe('');
  });

  it('checkOOOStatus detects out of office', () => {
    const oooResponse = { time_entries: [{ note: 'OOO today' }] };
    expect(checkOOOStatus(oooResponse, 0, false)).toBe(true);
    expect(checkOOOStatus({}, 8, false)).toBe(false);
  });
});
