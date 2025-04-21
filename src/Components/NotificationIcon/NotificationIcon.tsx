import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../Config/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../Types/navigation';

interface Notification {
  id: string;
  type: 'new_game' | 'moves_submitted' | 'round_over' | 'game_over';
  message: string;
  game_id: string | null;
  round_id: string | null;
  sender_id: string | null;
  is_read: boolean;
  created_at: string;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'new_game':
      return 'game-controller';
    case 'moves_submitted':
      return 'checkmark-circle';
    case 'round_over':
      return 'flag';
    case 'game_over':
      return 'trophy';
    default:
      return 'notifications';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'new_game':
      return '#4c669f';
    case 'moves_submitted':
      return '#5cb85c';
    case 'round_over':
      return '#f0ad4e';
    case 'game_over':
      return '#d9534f';
    default:
      return '#777';
  }
};

const NotificationIcon = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState(false);

  useEffect(() => {
    loadNotifications();

    // Set up subscription for real-time updates
    const notificationsSubscription = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.(select id from profiles where user_id=auth.uid())`
      }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsSubscription);
    };
  }, []);

  useEffect(() => {
    // Calculate unread count whenever notifications change
    setUnreadCount(notifications.filter(n => !n.is_read).length);
  }, [notifications]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Calculate time difference in milliseconds
    const diff = now.getTime() - date.getTime();
    
    // Convert to minutes, hours, days
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if it's not already
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    
    // Navigate based on notification type
    if (notification.game_id) {
      if (notification.round_id && (notification.type === 'moves_submitted' || notification.type === 'round_over')) {
        // Navigate to specific round
        navigation.navigate('GameRound', {
          gameId: notification.game_id,
          roundId: notification.round_id
        });
      } else {
        // Navigate to game details
        navigation.navigate('GameDetails', {
          gameId: notification.game_id
        });
      }
    }
    
    // Close dropdown
    setShowDropdown(false);
  };

  const markAsRead = async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;
    
    setMarkingAsRead(true);
    try {
      const { error } = await supabase.rpc('mark_notifications_as_read', {
        notification_ids: notificationIds
      });

      if (error) throw error;

      // Update local state to mark as read
      setNotifications(prevNotifications => 
        prevNotifications.map(n => 
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
    } catch (error: any) {
      console.error('Error marking notifications as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    } finally {
      setMarkingAsRead(false);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    await markAsRead(unreadIds);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => setShowDropdown(!showDropdown)}
      >
        <Ionicons name="notifications" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowDropdown(false)}
        >
          <View 
            style={styles.dropdown}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllReadButton}
                  onPress={markAllAsRead}
                  disabled={markingAsRead}
                >
                  <Text style={styles.markAllReadText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.notificationItem,
                      !item.is_read && styles.unreadNotification
                    ]}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View 
                      style={[
                        styles.notificationIconContainer,
                        { backgroundColor: getTypeColor(item.type) }
                      ]}
                    >
                      <Ionicons 
                        name={getNotificationIcon(item.type)} 
                        size={20} 
                        color="white" 
                      />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationMessage}>{item.message}</Text>
                      <Text style={styles.notificationTime}>
                        {formatNotificationTime(item.created_at)}
                      </Text>
                    </View>
                    {!item.is_read && (
                      <View style={styles.unreadDot} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.notificationsList}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  iconButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#d9534f',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  dropdown: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: width * 0.85,
    maxHeight: height * 0.7,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  markAllReadButton: {
    padding: 8,
  },
  markAllReadText: {
    color: '#4c669f',
    fontSize: 14,
  },
  notificationsList: {
    maxHeight: height * 0.6,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: '#f0f7ff',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4c669f',
    marginLeft: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default NotificationIcon; 