import React, { useEffect, useRef, useState } from "react";

import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    title: "Match with the right caregiver",
    description: "Post a job, compare profiles and read reviews.",
    image: require("@/assets/images/slide1.jpg"),
  },
  {
    id: "2",
    title: "Find the care you need now",
    description: "Child care, senior care, pet care, housekeeping and more.",
    image: require("@/assets/images/slide2.jpg"),
  },
  {
    id: "3",
    title: "Your safety is our priority",
    description: "Tools to help you search, connect, screen, and hire.",
    image: require("@/assets/images/slide3.jpg"),
  },
];

export default function LandingScreen({ navigation }: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % slides.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }, 2500);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const renderItem = ({ item }: any) => (
    <ImageBackground
      source={item.image}
      style={styles.slide}
      resizeMode="cover"
    >
      <View style={styles.darkOverlay}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    </ImageBackground>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" />
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/logo-icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>Carelum</Text>
      </View>
      <FlatList
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        ref={flatListRef}
      />

      <View style={styles.bottomCard}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.activeDot]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.getStarted}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.login}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.loginText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    height,
    justifyContent: "flex-start",
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // darkens image
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: 15,
    marginTop: 400,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  description: {
    fontSize: 18,
    color: "#eee",
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    marginBottom: 20,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: "#7D3DD2",
  },
  getStarted: {
    backgroundColor: "#7D3DD2",
    paddingVertical: 16,
    borderRadius: 30,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  getStartedText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  login: {
    borderColor: "#7D3DD2",
    borderWidth: 2,
    paddingVertical: 16,
    borderRadius: 30,
    width: "100%",
    alignItems: "center",
  },
  loginText: {
    color: "#003f2b",
    fontWeight: "bold",
    fontSize: 16,
  },
  logoContainer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
    justifyContent: "flex-start",
  },
  logoImage: {
    marginTop: 80,
    width: 40,
    height: 40,
    marginRight: 20,
    marginLeft: 60,
    transform: [{ scale: 5 }],
  },
  logoText: {
    marginTop: 80,
    color: "#fff",
    fontSize: 35,
    fontWeight: "bold",
    textShadowColor: "#7D3DD2", // optional for visibility
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
});
