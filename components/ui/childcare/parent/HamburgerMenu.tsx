import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

export default function HamburgerMenu({ visible, onClose, navigation }: Props) {
  // Create an Animated value for the drawer position
  const drawerPosition = React.useRef(new Animated.Value(250)).current; // initial position off-screen

  // Slide the drawer in or out based on visibility
  React.useEffect(() => {
    Animated.timing(drawerPosition, {
      toValue: visible ? 0 : 250, // 0 is the fully visible position, 250 is off the screen to the right
      duration: 300, // Slide duration
      useNativeDriver: true,
    }).start();
  }, [visible, drawerPosition]);

  const go = (screen: string) => {
    onClose();
    navigation.navigate(screen as never);
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.drawer,
                { transform: [{ translateX: drawerPosition }] },
              ]} // Apply translateX for sliding effect
            >
              <TouchableOpacity
                style={styles.item}
                onPress={() => go("Profile")}
              >
                <Ionicons
                  name="person-circle"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.item}
                onPress={() => go("Schedule")}
              >
                <Ionicons
                  name="calendar"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>My Bookings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.item}
                onPress={() => go("Messages")}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.item}
                onPress={() => go("ChildProfiles")}
              >
                <Ionicons
                  name="people"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>Child Profiles</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.item}
                onPress={() => go("Settings")}
              >
                <Ionicons
                  name="settings"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.item} onPress={() => go("Login")}>
                <Ionicons
                  name="log-out"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
                <Text style={styles.text}>Logout</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
  },
  drawer: {
    width: 250,
    backgroundColor: "#fff",
    paddingTop: 60,
    position: "absolute",
    right: 0, // Position drawer on the right
    height: "100%", // Full screen height
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
  },
  icon: {
    marginRight: 15,
  },
  text: {
    fontSize: 16,
    color: "#333",
  },
});
