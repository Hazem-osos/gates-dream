import { describe, expect, it } from 'vitest';
import { caretArrowLeaves, lineArrowDestination } from './gridLineFocus';

const ORDER = ['item', 'quantity', 'unitPrice'] as const;

describe('lineArrowDestination', () => {
  it('moves visually in an RTL grid: left is next, right is previous', () => {
    expect(lineArrowDestination(ORDER, 'item', 0, 'ArrowLeft', true)).toEqual({
      lineIndex: 0,
      field: 'quantity',
    });
    expect(lineArrowDestination(ORDER, 'quantity', 1, 'ArrowRight', true)).toEqual({
      lineIndex: 1,
      field: 'item',
    });
  });

  it('wraps to the next row after the last field and to the previous row before the first', () => {
    expect(lineArrowDestination(ORDER, 'unitPrice', 2, 'ArrowLeft', true)).toEqual({
      lineIndex: 3,
      field: 'item',
    });
    expect(lineArrowDestination(ORDER, 'item', 2, 'ArrowRight', true)).toEqual({
      lineIndex: 1,
      field: 'unitPrice',
    });
    expect(lineArrowDestination(ORDER, 'item', 0, 'ArrowRight', true)).toBeNull();
  });

  it('keeps the same field when moving up and down', () => {
    expect(lineArrowDestination(ORDER, 'quantity', 1, 'ArrowDown', true)).toEqual({
      lineIndex: 2,
      field: 'quantity',
    });
    expect(lineArrowDestination(ORDER, 'quantity', 1, 'ArrowUp', true)).toEqual({
      lineIndex: 0,
      field: 'quantity',
    });
    expect(lineArrowDestination(ORDER, 'quantity', 0, 'ArrowUp', true)).toBeNull();
  });
});

describe('caretArrowLeaves', () => {
  it('stays inside the text until the visual edge', () => {
    expect(
      caretArrowLeaves({
        kind: 'text',
        listOpen: false,
        start: 2,
        end: 2,
        length: 5,
        rtl: true,
        key: 'ArrowLeft',
      })
    ).toBe(false);
    expect(
      caretArrowLeaves({
        kind: 'text',
        listOpen: false,
        start: 5,
        end: 5,
        length: 5,
        rtl: true,
        key: 'ArrowLeft',
      })
    ).toBe(true);
    expect(
      caretArrowLeaves({
        kind: 'text',
        listOpen: false,
        start: 0,
        end: 0,
        length: 5,
        rtl: true,
        key: 'ArrowRight',
      })
    ).toBe(true);
  });

  it('leaves immediately when the whole value is selected', () => {
    expect(
      caretArrowLeaves({
        kind: 'text',
        listOpen: false,
        start: 0,
        end: 4,
        length: 4,
        rtl: true,
        key: 'ArrowLeft',
      })
    ).toBe(true);
  });

  it('does not steal vertical arrows from an open list or a native select', () => {
    expect(
      caretArrowLeaves({
        kind: 'text',
        listOpen: true,
        start: 0,
        end: 0,
        length: 0,
        rtl: true,
        key: 'ArrowDown',
      })
    ).toBe(false);
    expect(
      caretArrowLeaves({
        kind: 'select',
        listOpen: false,
        start: null,
        end: null,
        length: 0,
        rtl: true,
        key: 'ArrowDown',
      })
    ).toBe(false);
    expect(
      caretArrowLeaves({
        kind: 'select',
        listOpen: false,
        start: null,
        end: null,
        length: 0,
        rtl: true,
        key: 'ArrowLeft',
      })
    ).toBe(true);
  });
});
