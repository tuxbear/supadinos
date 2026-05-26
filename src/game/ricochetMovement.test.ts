import {
  calculateRobotMove,
  applyMove,
  checkWinCondition,
  Robot,
  Wall,
} from './ricochetMovement';

describe('ricochetMovement', () => {
  const robots: Robot[] = [
    { color: 'red', x: 2, y: 2 },
    { color: 'blue', x: 5, y: 5 },
  ];

  it('slides until board edge', () => {
    const result = calculateRobotMove(
      robots[0],
      16,
      2,
      robots,
      [],
      16
    );
    expect(result).toEqual({ x: 16, y: 2 });
  });

  it('stops at another robot', () => {
    const blocking: Robot[] = [
      { color: 'red', x: 2, y: 2 },
      { color: 'blue', x: 5, y: 2 },
    ];
    const result = calculateRobotMove(blocking[0], 8, 2, blocking, [], 16);
    expect(result.x).toBe(4);
  });

  it('stops at wall', () => {
    const walls: Wall[] = [{ x: 4, y: 2, direction: 'west' }];
    const result = calculateRobotMove(robots[0], 8, 2, robots, walls, 16);
    expect(result.x).toBeLessThanOrEqual(4);
  });

  it('applyMove updates only moved robot', () => {
    const next = applyMove(robots, {
      robotColor: 'red',
      fromX: 2,
      fromY: 2,
      toX: 4,
      toY: 2,
    });
    expect(next.find((r) => r.color === 'red')).toEqual({ color: 'red', x: 4, y: 2 });
    expect(next.find((r) => r.color === 'blue')).toEqual({ color: 'blue', x: 5, y: 5 });
  });

  it('detects win on matching target color', () => {
    expect(checkWinCondition(3, 3, 'red', [{ x: 3, y: 3, color: 'red' }])).toBe(true);
    expect(checkWinCondition(3, 3, 'blue', [{ x: 3, y: 3, color: 'red' }])).toBe(false);
  });
});
