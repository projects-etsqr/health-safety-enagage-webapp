import {
  formatDate,
  formatTime,
  formatDateTime,
  capitalise,
  initials,
  formatPct,
} from '../../src/utils/formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    it('returns em-dash for null', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('returns em-dash for undefined', () => {
      expect(formatDate(undefined)).toBe('—');
    });

    it('returns em-dash for empty string', () => {
      expect(formatDate('')).toBe('—');
    });

    it('formats an ISO string to en-GB short date', () => {
      // Use a fixed timestamp; en-GB gives "15 Jun 2025"
      const out = formatDate('2025-06-15T10:30:00.000Z');
      expect(out).toMatch(/15/);
      expect(out).toMatch(/2025/);
    });
  });

  describe('formatTime', () => {
    it('returns em-dash for null', () => {
      expect(formatTime(null)).toBe('—');
    });

    it('returns em-dash for undefined', () => {
      expect(formatTime(undefined)).toBe('—');
    });

    it('returns em-dash for empty string', () => {
      expect(formatTime('')).toBe('—');
    });

    it('returns a HH:MM string for a valid ISO date', () => {
      const out = formatTime('2025-06-15T10:30:00.000Z');
      expect(out).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('formatDateTime', () => {
    it('returns em-dash for null', () => {
      expect(formatDateTime(null)).toBe('—');
    });

    it('returns em-dash for undefined', () => {
      expect(formatDateTime(undefined)).toBe('—');
    });

    it('returns em-dash for empty string', () => {
      expect(formatDateTime('')).toBe('—');
    });

    it('combines date and time with a space for a valid ISO', () => {
      const out = formatDateTime('2025-06-15T10:30:00.000Z');
      expect(out).toContain(' ');
      expect(out).toMatch(/15/);
      expect(out).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe('capitalise', () => {
    it('returns empty string for null', () => {
      expect(capitalise(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(capitalise(undefined)).toBe('');
    });

    it('uppercases the first letter and lowercases the rest', () => {
      expect(capitalise('hELLO')).toBe('Hello');
      expect(capitalise('wORLD')).toBe('World');
    });

    it('handles a single lowercase character', () => {
      expect(capitalise('a')).toBe('A');
    });
  });

  describe('initials', () => {
    it('returns ? for null', () => {
      expect(initials(null)).toBe('?');
    });

    it('returns ? for undefined', () => {
      expect(initials(undefined)).toBe('?');
    });

    it('returns ? for empty string', () => {
      expect(initials('')).toBe('?');
    });

    it('returns first letter of single word', () => {
      expect(initials('alice')).toBe('A');
    });

    it('returns first letters of up to two words, uppercased', () => {
      expect(initials('alice johnson')).toBe('AJ');
    });

    it('ignores words beyond the first two', () => {
      expect(initials('alice bob carol dave')).toBe('AB');
    });
  });

  describe('formatPct', () => {
    it('rounds and appends a percent sign', () => {
      expect(formatPct(50)).toBe('50%');
    });

    it('rounds 50.6 up to 51%', () => {
      expect(formatPct(50.6)).toBe('51%');
    });

    it('rounds 50.4 down to 50%', () => {
      expect(formatPct(50.4)).toBe('50%');
    });

    it('handles 0', () => {
      expect(formatPct(0)).toBe('0%');
    });

    it('handles 100', () => {
      expect(formatPct(100)).toBe('100%');
    });
  });
});
