import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TopBar from "../../TopBar";

export default function ChildProfilesScreen({ navigation }: any) {
  const [children, setChildren] = useState([
    { id: "1", name: "Tim", age: "4" },
  ]);
  return (
    <View style={{ flex: 1 }}>
      <TopBar navigation={navigation} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>Child Profiles</Text>
        {children.map((child) => (
          <View key={child.id} style={styles.card}>
            <Text style={styles.name}>{child.name}</Text>
            <Text style={styles.age}>{child.age} years old</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addText}>Add Child</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: "#f7f1eb",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  age: {
    color: "#555",
  },
  addButton: {
    backgroundColor: "#7D3DD2",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  addText: {
    color: "#fff",
    fontWeight: "600",
  },
});
