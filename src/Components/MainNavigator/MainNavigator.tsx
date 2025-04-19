import React, { useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import SignUpScreen from "@screens/SignUpScreen";
import SplashScreen from "@screens/SplashScreen";
import SignInScreen from "@screens/SignInScreen";
import HomeScreen from "@screens/HomeScreen";
import VerificationScreen from "@screens/VerificationScreen";
import ChangePasswordScreen from "@screens/ChangePasswordScreen";
import ButtonExamples from "@screens/ButtonExamples";
import supabase from "@config/supabase";
import { Session } from "@supabase/supabase-js";
import GamesListScreen from '@screens/GamesListScreen';
import CreateGameScreen from '@screens/CreateGameScreen';
import GameRoundScreen from '@screens/GameRoundScreen';
import FriendsScreen from '@screens/FriendsScreen';
import ProfileScreen from '@screens/ProfileScreen';
import SettingsScreen from '@screens/SettingsScreen';

const Stack = createStackNavigator();

const MainNavigator = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
        initialRouteName="SplashScreen"
      >
        {session ? (
          <>
            <Stack.Screen name="HomeScreen" component={HomeScreen} />
            <Stack.Screen name="VerificationScreen" component={VerificationScreen} />
            <Stack.Screen name="ButtonExamples" component={ButtonExamples} />
            <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: true, title: 'My Friends' }} />
            <Stack.Screen name="GamesList" component={GamesListScreen} options={{ headerShown: true, title: 'My Games' }} />
            <Stack.Screen name="CreateGame" component={CreateGameScreen} options={{ headerShown: true, title: 'Create New Game' }} />
            <Stack.Screen name="GameRound" component={GameRoundScreen} options={{ headerShown: true, title: 'Game Round' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true }} />
          </>
        ) : (
          <>
            <Stack.Screen name="SplashScreen" component={SplashScreen} />
            <Stack.Screen name="SignInScreen" component={SignInScreen} />
            <Stack.Screen name="SignUpScreen" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default MainNavigator;