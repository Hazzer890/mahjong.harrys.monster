import { describe, expect, test } from 'bun:test';
import { parseRoomPath, shouldApply, wsUrl } from './useGame';

describe('useGame helpers', () => {
  test('wsUrl selects the WebSocket scheme from the page protocol', () => {
    expect(wsUrl({ protocol: 'http:', host: 'localhost:5173' }))
      .toBe('ws://localhost:5173/ws');
    expect(wsUrl({ protocol: 'https:', host: 'mahjong.example' }))
      .toBe('wss://mahjong.example/ws');
  });

  test('shouldApply rejects lower sequence numbers only', () => {
    expect(shouldApply(7, 6)).toBe(false);
    expect(shouldApply(7, 7)).toBe(true);
    expect(shouldApply(7, 8)).toBe(true);
  });

  test('parseRoomPath accepts only room paths and normalizes their code', () => {
    expect(parseRoomPath('/r/ABCD')).toBe('ABCD');
    expect(parseRoomPath('/r/abcd')).toBe('ABCD');
    expect(parseRoomPath('/')).toBeNull();
    expect(parseRoomPath('/rooms/ABCD')).toBeNull();
    expect(parseRoomPath('/r/ABCD/extra')).toBeNull();
  });
});
