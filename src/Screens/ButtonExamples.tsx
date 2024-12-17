import Button from '@components/Buttons/Button';
import React, { useState } from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
//@ts-ignore
import { MaterialIcons } from 'react-native-vector-icons';

const ButtonExamples = ({navigation}) => {
    const [isDisabled, setIsDisabled] = useState(true);
    const toggleButtonState = () => {
        setIsDisabled((prevState) => !prevState);
    };

    return (
        <SafeAreaView>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <View style={{ flexDirection: 'row' }}>
                    <MaterialIcons name="arrow-back" size={24} onPress={() => {navigation.goBack()}}/>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Button Examples</Text>
                    </View>
                
                {/* Primary Buttons */}
                <View style={{ marginVertical: 10 }}>
                    <Text style={{ marginBottom: 5 }}>Primary Buttons</Text>
                    <Button 
                        title="Primary Small Button"
                        onPress={() => {}}
                        variant="primary"
                        size="small"
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title="Primary Medium Button"
                        onPress={() => {}}
                        variant="primary"
                        size="medium"
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title="Primary Large Button"
                        onPress={() => {}}
                        variant="primary"
                        size="large"
                    />
                </View>

                {/* Secondary Buttons */}
                <View style={{ marginVertical: 10 }}>
                    <Text style={{ marginBottom: 5 }}>Secondary Buttons</Text>
                    <Button 
                        title="Secondary Small Button"
                        onPress={() => {}}
                        variant="secondary"
                        size="small"
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title="Secondary Medium Button"
                        onPress={() => {}}
                        variant="secondary"
                        size="medium"
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title="Secondary Large Button"
                        onPress={() => {}}
                        variant="secondary"
                        size="large"
                    />
                </View>

                {/* Disabled Buttons */}
                <View style={{ marginVertical: 10 }}>
                    <Text style={{ marginBottom: 5 }}>Disabled Buttons</Text>
                    <Button 
                        title={isDisabled ? "Press to Enable Buttons" : "Press to Disable Buttons"}
                        onPress={toggleButtonState}
                        variant="primary"
                        size="small"
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title={isDisabled ? "Disabled Small Button" : "Enabled Small Button"}
                        onPress={() => {}}
                        variant="primary"
                        size="small"
                        disabled={isDisabled}
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title={isDisabled ? "Disabled Medium Button" : "Enabled Medium Button"}
                        onPress={() => {}}
                        variant="primary"
                        size="medium"
                        disabled={isDisabled}
                    />
                    <View style={styles.spacer} />
                    <Button 
                        title={isDisabled ? "Disabled  Large Button" : "Enabled Large Button"}
                        onPress={() => {}}
                        variant="primary"
                        size="large"
                        disabled={isDisabled}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    spacer: {
        marginVertical: 5,
    },
});

export default ButtonExamples;
