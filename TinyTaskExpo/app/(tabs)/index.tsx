import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  NativeModules,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';

const { ActionRecorder } = NativeModules;

export default function TinyTaskExpo() {
  const [isRecording, setIsRecording] = useState(false);
  const [isServiceEnabled, setIsServiceEnabled] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<string[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const checkServiceStatus = async () => {
    if (Platform.OS === 'android' && ActionRecorder) {
      const enabled = await ActionRecorder.isServiceEnabled();
      setIsServiceEnabled(enabled);
    }
  };

  const loadSavedList = async () => {
    if (ActionRecorder) {
      const list = await ActionRecorder.getSavedRecordings();
      setSavedRecordings(list);
    }
  };

  useEffect(() => {
    checkServiceStatus();
    loadSavedList();
    const interval = setInterval(checkServiceStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    const name = `Recording_${new Date().getTime()}`;
    try {
      await ActionRecorder.saveRecording(name);
      Alert.alert('Success', `Recording saved as ${name}`);
      loadSavedList();
    } catch (e) {
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const handleLoad = async (name: string) => {
    try {
      await ActionRecorder.loadRecording(name);
      Alert.alert('Success', `Loaded ${name}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to load recording');
    }
  };

  useEffect(() => {
    if (isRecording) {
      startPulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleRecord = () => {
    if (!isServiceEnabled) {
      Alert.alert(
        'Permission Required',
        'Please enable the TinyTask Accessibility Service in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => ActionRecorder.openAccessibilitySettings() },
        ]
      );
      return;
    }

    if (isRecording) {
      ActionRecorder.stopRecording();
      setIsRecording(false);
    } else {
      ActionRecorder.startRecording();
      setIsRecording(true);
    }
  };

  const handlePlay = () => {
    if (!isServiceEnabled) {
      Alert.alert('Error', 'Accessibility Service is not enabled.');
      return;
    }
    ActionRecorder.playActions();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>TinyTask <Text style={styles.titleAccent}>Expo</Text></Text>
        <Text style={styles.subtitle}>Macro Recorder & Automation</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: isServiceEnabled ? '#00E676' : '#FF5252' }]} />
        <Text style={styles.statusText}>
          Service: {isServiceEnabled ? 'Active' : 'Inactive (Tap to setup)'}
        </Text>
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.recordButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity 
            style={[styles.recordButton, isRecording && styles.recordingActive]} 
            onPress={handleRecord}
            activeOpacity={0.7}
          >
            <View style={isRecording ? styles.stopIcon : styles.recordIcon} />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.instructionText}>
          {isRecording ? 'Recording actions...' : 'Tap to start recording'}
        </Text>

        <TouchableOpacity 
          style={[styles.playButton, isRecording && styles.disabledButton]} 
          onPress={handlePlay}
          disabled={isRecording}
        >
          <Text style={styles.playButtonText}>▶ PLAY</Text>
        </TouchableOpacity>

        {!isRecording && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>💾 SAVE CURRENT</Text>
          </TouchableOpacity>
        )}
      </View>

      {savedRecordings.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedTitle}>Saved Recordings</Text>
          <View style={styles.savedList}>
            {savedRecordings.map((name) => (
              <TouchableOpacity key={name} style={styles.savedItem} onPress={() => handleLoad(name)}>
                <Text style={styles.savedItemText}>{name}</Text>
                <Text style={styles.loadText}>LOAD</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!isServiceEnabled && (
        <TouchableOpacity style={styles.setupCard} onPress={() => ActionRecorder.openAccessibilitySettings()}>
          <Text style={styles.setupTitle}>⚠️ Setup Required</Text>
          <Text style={styles.setupDescription}>
            TinyTask needs Accessibility Permission to record and replay touches.
          </Text>
          <Text style={styles.setupAction}>TAP TO ENABLE</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Expo Development Build v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  titleAccent: {
    color: '#38BDF8',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 40,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonContainer: {
    marginBottom: 20,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF5252',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  recordingActive: {
    backgroundColor: '#1E293B',
    borderWidth: 4,
    borderColor: '#FF5252',
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
  },
  stopIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#FF5252',
    borderRadius: 4,
  },
  instructionText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 40,
  },
  playButton: {
    backgroundColor: '#38BDF8',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 30,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  playButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  saveButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  savedSection: {
    padding: 20,
    maxHeight: 250,
  },
  savedTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 1,
  },
  savedList: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  savedItemText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  loadText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  setupCard: {
    margin: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  setupTitle: {
    color: '#FF5252',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  setupDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  setupAction: {
    color: '#FF5252',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#475569',
    fontSize: 12,
  },
});
