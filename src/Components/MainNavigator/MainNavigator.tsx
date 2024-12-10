import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import SignUpScreen from "@screens/SignUpScreen";
import SplashScreen from "@screens/SplashScreen";

const Stack = createStackNavigator();

const MainNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator
                id={undefined}
                initialRouteName="SplashScreen"
                screenOptions={{
                headerShown: false,
                gestureEnabled: false,
                }}>
                <Stack.Screen name="SignUpScreen" component={SignUpScreen} />
                <Stack.Screen name="SplashScreen" component={SplashScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default MainNavigator;