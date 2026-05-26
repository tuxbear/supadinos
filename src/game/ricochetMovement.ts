export const BOARD_SIZE = 16;

export interface Robot {
  id?: string;
  color: string;
  x: number;
  y: number;
}

export interface Wall {
  x: number;
  y: number;
  direction: 'north' | 'east' | 'south' | 'west';
}

export interface SlideMove {
  robotColor: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

function isWallBlocking(
  walls: Wall[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);

  return walls.some((wall) => {
    const blocksExit =
      wall.x === fromX &&
      wall.y === fromY &&
      ((stepX > 0 && wall.direction === 'east') ||
        (stepX < 0 && wall.direction === 'west') ||
        (stepY > 0 && wall.direction === 'south') ||
        (stepY < 0 && wall.direction === 'north'));

    const blocksEntry =
      wall.x === toX &&
      wall.y === toY &&
      ((stepX > 0 && wall.direction === 'west') ||
        (stepX < 0 && wall.direction === 'east') ||
        (stepY > 0 && wall.direction === 'north') ||
        (stepY < 0 && wall.direction === 'south'));

    return blocksExit || blocksEntry;
  });
}

export function calculateRobotMove(
  robot: Robot,
  targetX: number,
  targetY: number,
  robots: Robot[],
  walls: Wall[],
  boardSize: number = BOARD_SIZE
): { x: number; y: number } {
  let dirX = 0;
  let dirY = 0;

  if (targetX !== robot.x) {
    dirX = targetX > robot.x ? 1 : -1;
  } else if (targetY !== robot.y) {
    dirY = targetY > robot.y ? 1 : -1;
  } else {
    return { x: robot.x, y: robot.y };
  }

  let currentX = robot.x;
  let currentY = robot.y;

  while (true) {
    const nextX = currentX + dirX;
    const nextY = currentY + dirY;

    if (nextX < 1 || nextX > boardSize || nextY < 1 || nextY > boardSize) {
      break;
    }

    if (
      isWallBlocking(walls, currentX, currentY, nextX, nextY) ||
      robots.some((r) => r.color !== robot.color && r.x === nextX && r.y === nextY)
    ) {
      break;
    }

    currentX = nextX;
    currentY = nextY;
  }

  return { x: currentX, y: currentY };
}

export function applyMove(robots: Robot[], move: SlideMove): Robot[] {
  return robots.map((r) =>
    r.color === move.robotColor ? { ...r, x: move.toX, y: move.toY } : r
  );
}

export function checkWinCondition(
  x: number,
  y: number,
  color: string,
  targets: { x: number; y: number; color: string }[]
): boolean {
  const target = targets.find((t) => t.x === x && t.y === y);
  return Boolean(target && target.color === color);
}
