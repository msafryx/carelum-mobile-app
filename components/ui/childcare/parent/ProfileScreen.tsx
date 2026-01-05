import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TopBar from "../../TopBar";

export default function ProfileScreen({ navigation }: any) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("Jane Parent");
  const [email, setEmail] = useState("jane@example.com");
  const [phone, setPhone] = useState("555-1234");
  const [children, setChildren] = useState([
    { id: "1", name: "Tim", age: "4" },
    { id: "2", name: "Anna", age: "2" },
  ]);
  const [notifications, setNotifications] = useState({
    booking: true,
    sitter: true,
  });
  const [twoFA, setTwoFA] = useState(false);

  const toggleEdit = () => setEditing((e) => !e);

  return (
    <View style={{ flex: 1 }}>
      <TopBar navigation={navigation} />
      <Text style={styles.pageTitle}>My Profile</Text>
      <TouchableOpacity style={styles.editButton} onPress={toggleEdit}>
        <Ionicons
          name={editing ? "checkmark" : "pencil"}
          size={22}
          color="#7D3DD2"
        />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Image
            source={require("@/assets/images/adult.webp")}
            style={styles.avatar}
          />
          {editing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          ) : (
            <Text style={styles.name}>{name}</Text>
          )}
          {editing ? (
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
            />
          ) : (
            <Text>{email}</Text>
          )}
          {editing ? (
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />
          ) : (
            <Text>{phone}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children</Text>
          {children.map((c) => (
            <View key={c.id} style={styles.childRow}>
              <Ionicons name="person-circle" size={30} color="#7D3DD2" />
              {editing ? (
                <TextInput
                  value={`${c.name}, ${c.age}`}
                  style={styles.inputFlex}
                />
              ) : (
                <Text style={styles.childText}>
                  {c.name} ({c.age})
                </Text>
              )}
            </View>
          ))}
          {editing && (
            <TouchableOpacity
              style={styles.addChild}
              onPress={() =>
                setChildren((cs) => [
                  ...cs,
                  { id: String(cs.length + 1), name: "New", age: "" },
                ])
              }
            >
              <Ionicons name="add" size={20} color="#7D3DD2" />
              <Text style={styles.addText}>Add Child</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <Text>Visa ending 4242</Text>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking History</Text>
          <Text>No past bookings.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Booking Reminders</Text>
            <Switch
              value={notifications.booking}
              onValueChange={(v) =>
                setNotifications((n) => ({ ...n, booking: v }))
              }
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>New Sitter Alerts</Text>
            <Switch
              value={notifications.sitter}
              onValueChange={(v) =>
                setNotifications((n) => ({ ...n, sitter: v }))
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Two-Factor Authentication</Text>
            <Switch value={twoFA} onValueChange={setTwoFA} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 40,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  editButton: {
    position: "absolute",
    right: 10,
    top: 40,
    padding: 4,
  },
  container: {
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: "#f7f1eb",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    alignItems: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f0e9ff",
    width: "100%",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  sectionTitle: {
    alignSelf: "flex-start",
    fontWeight: "600",
    marginBottom: 10,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    alignSelf: "stretch",
  },
  childText: {
    marginLeft: 8,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: "#f0e9ff",
    borderRadius: 10,
    padding: 6,
    marginLeft: 8,
  },
  addChild: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  addText: {
    marginLeft: 4,
    color: "#7D3DD2",
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 8,
  },
  linkText: {
    color: "#7D3DD2",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 16,
  },
});
