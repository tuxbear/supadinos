import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '@config/supabase';

// Define the screen dimensions
const { width } = Dimensions.get('window');
const BOARD_SIZE = Math.floor(width * 0.9);
const CELL_SIZE = Math.floor(BOARD_SIZE / 16);

// Define colors for robots and targets
const ROBOT_COLORS = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f'
};

interface RoundParams {
  gameId: string;
  roundId: string;
}

interface Robot {
  id: string;
  color: string;
  x: number;
  y: number;
}

interface Target {
  id: string;
  color: string;
  x: number;
  y: number;
}

interface Wall {
  id: string;
  x: number;
  y: number;
  direction: 'north' | 'east' | 'south' | 'west';
}

interface Move {
  robotColor: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface GameState {
  game: {
    id: string;
    name: string;
    status: string;
    max_players: number;
    max_rounds: number;
    created_at: string;
    current_round: number;
  };
  participants: {
    id: string;
    username: string;
    avatar_url: string | null;
    score: number;
  }[];
  current_board: {
    id: string;
    config: any;
    robots: Robot[];
    targets: Target[];
    walls: Wall[];
  };
}

const GameRoundScreen = () => {
  const route = useRoute<RouteProp<Record<string, RoundParams>, string>>();
  const navigation = useNavigation();
  const { gameId, roundId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    // Load initial game state
    loadGameState();

    // Set up subscription for real-time updates
    const gameChangesSubscription = supabase
      .channel('game-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `id=eq.${roundId}`
      }, () => {
        loadGameState();
      })
      .subscribe();

    return () => {
      // Clean up timer and subscription
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      supabase.removeChannel(gameChangesSubscription);
    };
  }, [gameId, roundId]);

  const loadGameState = async () => {
    setLoading(true);
    try {
      // Fetch game state
      const { data: gameStateData, error: gameStateError } = await supabase.rpc('get_game_state', {
        game_uuid: gameId
      });

      if (gameStateError) {
        throw gameStateError;
      }

      setGameState(gameStateData);

      // Start the timer if round is active and not already started
      const roundData = gameStateData?.current_board;
      if (roundData && !gameStartedRef.current) {
        startRound();
        gameStartedRef.current = true;
      }
    } catch (error) {
      console.error('Error loading game state:', error);
      Alert.alert('Error', 'Failed to load game state');
    } finally {
      setLoading(false);
    }
  };

  const startRound = async () => {
    try {
      // Start the round in the database
      const { error } = await supabase.rpc('start_round', {
        round_id: roundId
      });

      if (error) {
        throw error;
      }

      // Start the timer
      startTimer();
    } catch (error) {
      console.error('Error starting round:', error);
    }
  };

  const startTimer = () => {
    // Start a timer that increments every second
    timerRef.current = setInterval(() => {
      setTimer(prevTimer => prevTimer + 1);
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCellPress = (x: number, y: number) => {
    if (!gameState || !gameState.current_board) return;

    // If no robot is selected, check if there's a robot at this cell
    if (!selectedRobot) {
      const robot = gameState.current_board.robots.find(r => r.x === x && r.y === y);
      if (robot) {
        setSelectedRobot(robot);
      }
      return;
    }

    // If a robot is already selected, try to move it
    moveRobot(selectedRobot, x, y);
  };

  const moveRobot = (robot: Robot, targetX: number, targetY: number) => {
    if (!gameState || !gameState.current_board) return;

    // Calculate the path and final position
    const { x: finalX, y: finalY } = calculateRobotMove(
      robot, 
      targetX, 
      targetY, 
      gameState.current_board.robots,
      gameState.current_board.walls
    );

    // If the robot won't move, do nothing
    if (finalX === robot.x && finalY === robot.y) {
      return;
    }

    // Update the robot's position in the state
    const updatedRobots = gameState.current_board.robots.map(r => 
      r.id === robot.id ? { ...r, x: finalX, y: finalY } : r
    );

    // Update the game state
    setGameState({
      ...gameState,
      current_board: {
        ...gameState.current_board,
        robots: updatedRobots
      }
    });

    // Add the move to the moves list
    const newMove: Move = {
      robotColor: robot.color,
      fromX: robot.x,
      fromY: robot.y,
      toX: finalX,
      toY: finalY
    };
    setMoves([...moves, newMove]);

    // Update the selected robot
    setSelectedRobot({ ...robot, x: finalX, y: finalY });

    // Check if the robot has reached the target
    checkWinCondition(finalX, finalY, robot.color);
  };

  const calculateRobotMove = (
    robot: Robot, 
    targetX: number, 
    targetY: number, 
    robots: Robot[], 
    walls: Wall[]
  ) => {
    // Implementation of robot movement logic
    // This is a simplified version - in a real game, you'd need to implement
    // the exact movement rules of Ricochet Robots

    // Determine direction of movement
    let dirX = 0;
    let dirY = 0;

    if (targetX !== robot.x) {
      dirX = targetX > robot.x ? 1 : -1;
    } else if (targetY !== robot.y) {
      dirY = targetY > robot.y ? 1 : -1;
    } else {
      // Target is the same as current position
      return { x: robot.x, y: robot.y };
    }

    // Move the robot until it hits a wall or another robot
    let currentX = robot.x;
    let currentY = robot.y;
    let nextX = currentX;
    let nextY = currentY;
    let hitObstacle = false;

    while (!hitObstacle) {
      nextX = currentX + dirX;
      nextY = currentY + dirY;

      // Check if we hit the board edge
      if (nextX < 1 || nextX > 16 || nextY < 1 || nextY > 16) {
        hitObstacle = true;
        break;
      }

      // Check if we hit a wall
      const wallInDirection = walls.find(wall => {
        if (dirX > 0 && wall.x === currentX && wall.y === currentY && wall.direction === 'east') return true;
        if (dirX < 0 && wall.x === nextX && wall.y === nextY && wall.direction === 'east') return true;
        if (dirY > 0 && wall.x === currentX && wall.y === currentY && wall.direction === 'south') return true;
        if (dirY < 0 && wall.x === nextX && wall.y === nextY && wall.direction === 'south') return true;
        return false;
      });

      if (wallInDirection) {
        hitObstacle = true;
        break;
      }

      // Check if we hit another robot
      const robotInWay = robots.find(r => 
        r.id !== robot.id && r.x === nextX && r.y === nextY
      );

      if (robotInWay) {
        hitObstacle = true;
        break;
      }

      // Move to the next position
      currentX = nextX;
      currentY = nextY;
    }

    return { x: currentX, y: currentY };
  };

  const checkWinCondition = (x: number, y: number, color: string) => {
    if (!gameState || !gameState.current_board) return;

    // Check if there's a target at this position matching the robot's color
    const target = gameState.current_board.targets.find(
      t => t.x === x && t.y === y && t.color === color
    );

    if (target) {
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Alert the user and submit solution
      Alert.alert(
        'Congratulations!',
        `You solved the puzzle in ${moves.length} moves and ${formatTime(timer)}!`,
        [
          {
            text: 'Submit Solution',
            onPress: () => submitSolution()
          }
        ]
      );
    }
  };

  const submitSolution = async () => {
    if (!gameState || !gameState.current_board || moves.length === 0) return;

    setSubmitting(true);
    try {
      // Format the moves for submission
      const movesJson = moves.map((move, index) => ({
        color: move.robotColor,
        from_x: move.fromX,
        from_y: move.fromY,
        to_x: move.toX,
        to_y: move.toY
      }));

      // Submit the solution
      const { error } = await supabase.rpc('submit_solution', {
        round_uuid: roundId,
        moves_json: JSON.stringify(movesJson)
      });

      if (error) {
        throw error;
      }

      // Navigate back to the game list or next round
      navigation.navigate('GamesList' as never);
    } catch (error: any) {
      console.error('Error submitting solution:', error);
      Alert.alert('Error', error.message || 'Failed to submit solution');
    } finally {
      setSubmitting(false);
    }
  };

  const resetRound = () => {
    if (!gameState) return;

    // Reset the game state to initial
    loadGameState();
    
    // Clear moves
    setMoves([]);
    
    // Deselect robot
    setSelectedRobot(null);
  };

  const renderBoard = () => {
    if (!gameState || !gameState.current_board) return null;
    
    const board = gameState.current_board;
    
    // Create a 16x16 grid of cells
    const cells = [];
    for (let y = 1; y <= 16; y++) {
      for (let x = 1; x <= 16; x++) {
        // Check if there's a robot at this position
        const robot = board.robots.find(r => r.x === x && r.y === y);
        
        // Check if there's a target at this position
        const target = board.targets.find(t => t.x === x && t.y === y);
        
        // Get walls for this cell
        const cellWalls = board.walls.filter(w => w.x === x && w.y === y);
        
        cells.push(
          <TouchableOpacity
            key={`${x}-${y}`}
            style={[
              styles.cell,
              { left: (x - 1) * CELL_SIZE, top: (y - 1) * CELL_SIZE },
              selectedRobot && robot && robot.id === selectedRobot.id && styles.selectedCell
            ]}
            onPress={() => handleCellPress(x, y)}
          >
            {/* Draw walls */}
            {cellWalls.map(wall => (
              <View
                key={wall.id}
                style={[
                  styles.wall,
                  wall.direction === 'north' && styles.northWall,
                  wall.direction === 'east' && styles.eastWall,
                  wall.direction === 'south' && styles.southWall,
                  wall.direction === 'west' && styles.westWall
                ]}
              />
            ))}
            
            {/* Draw target */}
            {target && (
              <View
                style={[
                  styles.target,
                  { backgroundColor: ROBOT_COLORS[target.color as keyof typeof ROBOT_COLORS] || '#ddd' }
                ]}
              />
            )}
            
            {/* Draw robot */}
            {robot && (
              <View
                style={[
                  styles.robot,
                  { backgroundColor: ROBOT_COLORS[robot.color as keyof typeof ROBOT_COLORS] || '#ddd' }
                ]}
              />
            )}
          </TouchableOpacity>
        );
      }
    }
    
    return (
      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {cells}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {gameState?.game.name} - Round {gameState?.game.current_round}
        </Text>
        <Text style={styles.timer}>Time: {formatTime(timer)}</Text>
      </View>
      
      <View style={styles.gameInfo}>
        <Text style={styles.movesText}>Moves: {moves.length}</Text>
        {selectedRobot && (
          <View style={styles.selectedRobotInfo}>
            <Text>Selected: </Text>
            <View
              style={[
                styles.selectedRobotIndicator,
                { backgroundColor: ROBOT_COLORS[selectedRobot.color as keyof typeof ROBOT_COLORS] || '#ddd' }
              ]}
            />
          </View>
        )}
      </View>
      
      {renderBoard()}
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setSelectedRobot(null)}
        >
          <Ionicons name="close-circle" size={24} color="#d9534f" />
          <Text style={styles.controlButtonText}>Deselect</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={resetRound}
        >
          <Ionicons name="refresh" size={24} color="#f0ad4e" />
          <Text style={styles.controlButtonText}>Reset</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, submitting && styles.disabledButton]}
          onPress={submitSolution}
          disabled={submitting || moves.length === 0}
        >
          <Ionicons name="checkmark-circle" size={24} color="#5cb85c" />
          <Text style={styles.controlButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.movesContainer}>
        <Text style={styles.movesTitle}>Move History:</Text>
        <ScrollView style={styles.movesList}>
          {moves.map((move, index) => (
            <View key={index} style={styles.moveItem}>
              <View
                style={[
                  styles.moveRobotIndicator,
                  { backgroundColor: ROBOT_COLORS[move.robotColor as keyof typeof ROBOT_COLORS] || '#ddd' }
                ]}
              />
              <Text style={styles.moveText}>
                {index + 1}. ({move.fromX},{move.fromY}) → ({move.toX},{move.toY})
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f8f8f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d9534f',
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  movesText: {
    fontSize: 16,
    color: '#333',
  },
  selectedRobotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRobotIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  boardContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#333',
    position: 'relative',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: '#ccc',
    backgroundColor: 'white',
  },
  selectedCell: {
    backgroundColor: '#e8f0fe',
  },
  robot: {
    width: CELL_SIZE * 0.7,
    height: CELL_SIZE * 0.7,
    borderRadius: CELL_SIZE * 0.35,
    position: 'absolute',
    top: CELL_SIZE * 0.15,
    left: CELL_SIZE * 0.15,
  },
  target: {
    width: CELL_SIZE * 0.5,
    height: CELL_SIZE * 0.5,
    borderRadius: CELL_SIZE * 0.25,
    position: 'absolute',
    top: CELL_SIZE * 0.25,
    left: CELL_SIZE * 0.25,
    opacity: 0.5,
  },
  wall: {
    position: 'absolute',
    backgroundColor: '#333',
  },
  northWall: {
    width: CELL_SIZE,
    height: 2,
    top: 0,
    left: 0,
  },
  eastWall: {
    width: 2,
    height: CELL_SIZE,
    top: 0,
    right: 0,
  },
  southWall: {
    width: CELL_SIZE,
    height: 2,
    bottom: 0,
    left: 0,
  },
  westWall: {
    width: 2,
    height: CELL_SIZE,
    top: 0,
    left: 0,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  controlButtonText: {
    marginTop: 4,
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  movesContainer: {
    flex: 1,
    marginTop: 10,
  },
  movesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  movesList: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
  },
  moveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  moveRobotIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  moveText: {
    fontSize: 14,
    color: '#333',
  },
});

export default GameRoundScreen; 