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
  previous_rounds?: {
    id: string;
    round_number: number;
    winner_username: string;
    completed_at: string;
  }[];
}

interface PlayerMoves {
  player_username: string;
  player_avatar_url: string | null;
  moves: Move[];
  time_taken: number;
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [replayVisible, setReplayVisible] = useState(false);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [playerMoves, setPlayerMoves] = useState<PlayerMoves[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [replayTimer, setReplayTimer] = useState<NodeJS.Timeout | null>(null);
  const [replayingMoves, setReplayingMoves] = useState<Move[]>([]);
  const [currentReplayMove, setCurrentReplayMove] = useState<number>(0);
  const [replayPaused, setReplayPaused] = useState(false);

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

  // Function to fetch moves for a specific round
  const fetchRoundMoves = async (roundId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('moves')
        .select(`
          id,
          participant_id,
          robot_color,
          from_x,
          from_y,
          to_x,
          to_y,
          move_number,
          created_at,
          game_participants:participant_id (
            profiles:profile_id (username, avatar_url)
          )
        `)
        .eq('round_id', roundId)
        .order('participant_id')
        .order('move_number');

      if (error) {
        throw error;
      }

      // Group moves by player
      const movesByPlayer: Record<string, PlayerMoves> = {};
      
      data.forEach((move: any) => {
        const participantId = move.participant_id;
        const username = move.game_participants.profiles.username;
        const avatarUrl = move.game_participants.profiles.avatar_url;
        
        if (!movesByPlayer[participantId]) {
          movesByPlayer[participantId] = {
            player_username: username,
            player_avatar_url: avatarUrl,
            moves: [],
            time_taken: 0 // We'll calculate this later if time data is available
          };
        }
        
        movesByPlayer[participantId].moves.push({
          robotColor: move.robot_color,
          fromX: move.from_x,
          fromY: move.from_y,
          toX: move.to_x,
          toY: move.to_y
        });
      });
      
      setPlayerMoves(Object.values(movesByPlayer));
      
      // If there are moves to replay, set up the first player's moves
      if (Object.values(movesByPlayer).length > 0) {
        setReplayingMoves(Object.values(movesByPlayer)[0].moves);
        setCurrentReplayMove(0);
      }
    } catch (error) {
      console.error('Error fetching round moves:', error);
      Alert.alert('Error', 'Failed to fetch moves for this round');
    } finally {
      setLoading(false);
    }
  };

  // Function to load previous rounds data
  const fetchPreviousRounds = async () => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select(`
          id,
          round_number,
          completed_at,
          game_participants:winner_id (
            profiles:profile_id (username)
          )
        `)
        .eq('game_id', gameId)
        .not('completed_at', 'is', null)
        .order('round_number');

      if (error) {
        throw error;
      }

      // Format the data
      const previousRounds = data.map((round: any) => ({
        id: round.id,
        round_number: round.round_number,
        winner_username: round.game_participants?.profiles?.username || 'Unknown',
        completed_at: round.completed_at
      }));

      // Update the game state with previous rounds
      if (gameState) {
        setGameState({
          ...gameState,
          previous_rounds: previousRounds
        });
      }
    } catch (error) {
      console.error('Error fetching previous rounds:', error);
      Alert.alert('Error', 'Failed to fetch previous rounds');
    }
  };

  // Function to toggle the menu
  const toggleMenu = () => {
    if (!menuVisible) {
      // Fetch previous rounds data when opening the menu
      fetchPreviousRounds();
    }
    setMenuVisible(!menuVisible);
    // Close replay mode if closing menu
    if (menuVisible && replayVisible) {
      exitReplayMode();
    }
  };

  // Function to select a round for replay
  const selectRoundForReplay = (roundId: string) => {
    setSelectedRound(roundId);
    fetchRoundMoves(roundId);
    setReplayVisible(true);
    setMenuVisible(false);
  };

  // Function to start replay
  const startReplay = (playerIndex: number = 0) => {
    // Reset any existing replay timer
    if (replayTimer) {
      clearInterval(replayTimer);
    }

    // If there are players with moves
    if (playerMoves.length > 0) {
      // Select the player's moves to replay
      setReplayingMoves(playerMoves[playerIndex].moves);
      setCurrentReplayMove(0);
      setReplayPaused(false);

      // Create a copy of game state to modify during replay
      if (gameState && gameState.current_board) {
        // Start the replay timer
        const timer = setInterval(() => {
          setCurrentReplayMove(prev => {
            if (prev < replayingMoves.length - 1) {
              return prev + 1;
            } else {
              // Stop when we reach the end
              if (replayTimer) {
                clearInterval(replayTimer);
              }
              return prev;
            }
          });
        }, 1000 / replaySpeed);

        setReplayTimer(timer);
      }
    }
  };

  // Function to pause/resume replay
  const toggleReplayPause = () => {
    if (replayPaused) {
      // Resume replay
      startReplay(playerMoves.findIndex(p => 
        p.moves.length > 0 && p.moves[0] === replayingMoves[0]));
      setReplayPaused(false);
    } else {
      // Pause replay
      if (replayTimer) {
        clearInterval(replayTimer);
        setReplayTimer(null);
      }
      setReplayPaused(true);
    }
  };

  // Function to change replay speed
  const changeReplaySpeed = () => {
    // Cycle through speeds: 1x, 2x, 4x
    const newSpeed = replaySpeed === 1 ? 2 : replaySpeed === 2 ? 4 : 1;
    setReplaySpeed(newSpeed);
    
    // Restart replay with new speed if not paused
    if (!replayPaused && replayTimer) {
      clearInterval(replayTimer);
      startReplay(playerMoves.findIndex(p => 
        p.moves.length > 0 && p.moves[0] === replayingMoves[0]));
    }
  };

  // Function to exit replay mode
  const exitReplayMode = () => {
    if (replayTimer) {
      clearInterval(replayTimer);
    }
    setReplayVisible(false);
    setSelectedRound(null);
    setPlayerMoves([]);
    setReplayingMoves([]);
    setCurrentReplayMove(0);
    // Reset the board state
    loadGameState();
  };

  // Effect to update board with replay move
  useEffect(() => {
    if (replayVisible && replayingMoves.length > 0 && currentReplayMove < replayingMoves.length) {
      // Update board with the current move in the replay
      const move = replayingMoves[currentReplayMove];
      
      // Find the robot with the matching color
      if (gameState && gameState.current_board) {
        const updatedRobots = gameState.current_board.robots.map(robot => {
          if (robot.color === move.robotColor) {
            // Update the robot position
            return { ...robot, x: move.toX, y: move.toY };
          }
          return robot;
        });

        // Update the game state with the new robot positions
        setGameState({
          ...gameState,
          current_board: {
            ...gameState.current_board,
            robots: updatedRobots
          }
        });
      }
    }
  }, [currentReplayMove, replayingMoves]);

  // Render menu overlay
  const renderMenu = () => {
    if (!menuVisible) return null;

    return (
      <View style={styles.menuOverlay}>
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>Game Menu</Text>
          
          <Text style={styles.menuSectionTitle}>Previous Rounds</Text>
          {gameState?.previous_rounds && gameState.previous_rounds.length > 0 ? (
            <ScrollView style={styles.roundsList}>
              {gameState.previous_rounds.map(round => (
                <TouchableOpacity
                  key={round.id}
                  style={styles.roundItem}
                  onPress={() => selectRoundForReplay(round.id)}
                >
                  <Text style={styles.roundItemText}>
                    Round {round.round_number} - Winner: {round.winner_username}
                  </Text>
                  <Ionicons name="play-circle" size={24} color="#5cb85c" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>No previous rounds yet</Text>
          )}
          
          <TouchableOpacity
            style={styles.menuButton}
            onPress={toggleMenu}
          >
            <Text style={styles.menuButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render replay overlay
  const renderReplay = () => {
    if (!replayVisible) return null;

    return (
      <View style={styles.replayOverlay}>
        <View style={styles.replayHeader}>
          <Text style={styles.replayTitle}>Replay Mode</Text>
          {playerMoves.length > 0 && (
            <View style={styles.playerSelector}>
              {playerMoves.map((player, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.playerButton,
                    replayingMoves === player.moves && styles.playerButtonActive
                  ]}
                  onPress={() => {
                    setReplayingMoves(player.moves);
                    setCurrentReplayMove(0);
                    setReplayPaused(true);
                    if (replayTimer) {
                      clearInterval(replayTimer);
                      setReplayTimer(null);
                    }
                  }}
                >
                  <Text style={styles.playerButtonText}>{player.player_username}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.replayControls}>
          <TouchableOpacity
            style={styles.replayButton}
            onPress={toggleReplayPause}
          >
            <Ionicons 
              name={replayPaused ? "play" : "pause"} 
              size={20} 
              color="white" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.replayButton}
            onPress={changeReplaySpeed}
          >
            <Text style={styles.replayButtonText}>{replaySpeed}x</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.replayButton}
            onPress={exitReplayMode}
          >
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.replayProgress}>
          <Text style={styles.replayProgressText}>
            Move {currentReplayMove + 1} of {replayingMoves.length}
          </Text>
          {replayingMoves.length > 0 && currentReplayMove < replayingMoves.length && (
            <Text style={styles.moveDetails}>
              {replayingMoves[currentReplayMove].robotColor} robot: 
              ({replayingMoves[currentReplayMove].fromX}, {replayingMoves[currentReplayMove].fromY}) → 
              ({replayingMoves[currentReplayMove].toX}, {replayingMoves[currentReplayMove].toY})
            </Text>
          )}
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
        <TouchableOpacity
          style={styles.menuButton}
          onPress={toggleMenu}
        >
          <Ionicons name="menu" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.gameInfo}>
        <Text style={styles.movesText}>Moves: {moves.length}</Text>
        <Text style={styles.timer}>Time: {formatTime(timer)}</Text>
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
      
      {/* Only show game controls if not in replay mode */}
      {!replayVisible && (
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
      )}
      
      {/* Only show move history if not in replay mode */}
      {!replayVisible && (
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
      )}
      
      {/* Render menu and replay overlays */}
      {renderMenu()}
      {renderReplay()}
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
  menuButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  menuContent: {
    width: '80%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  roundsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  roundItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  roundItemText: {
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 16,
  },
  menuButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  replayOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    zIndex: 5,
  },
  replayHeader: {
    marginBottom: 12,
  },
  replayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'white',
    textAlign: 'center',
  },
  playerSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  playerButton: {
    backgroundColor: '#555',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  playerButtonActive: {
    backgroundColor: '#4c669f',
  },
  playerButtonText: {
    color: 'white',
    fontSize: 12,
  },
  replayControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  replayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4c669f',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  replayButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  replayProgress: {
    alignItems: 'center',
  },
  replayProgressText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  moveDetails: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
  },
});

export default GameRoundScreen; 