import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/config/theme';
import Header from '@/src/components/ui/Header';
import Card from '@/src/components/ui/Card';

interface Sitter {
  id: string;
  name: string;
  age: number;
  languages: string;
  qualifications: string;
  description: string;
  rating: number;
  reviews: number;
  rate: number;
  photo: any;
}

const sitters: Sitter[] = [
  {
    id: '1',
    name: 'Jane Doe',
    age: 28,
    languages: 'English, Spanish',
    qualifications: 'CPR Certified, First Aid',
    description: 'Experienced babysitter with 5 years of infant and toddler care.',
    rating: 4.5,
    reviews: 123,
    rate: 20,
    photo: require('@/assets/images/adult.webp'),
  },
  {
    id: '2',
    name: 'Sarah Lee',
    age: 32,
    languages: 'English',
    qualifications: 'CPR Certified',
    description: 'Former preschool teacher available for evenings and weekends.',
    rating: 4.7,
    reviews: 98,
    rate: 22,
    photo: require('@/assets/images/senior.webp'),
  },
  {
    id: '3',
    name: 'Maria Silva',
    age: 26,
    languages: 'English, Portuguese',
    qualifications: 'First Aid',
    description: 'Loves outdoor play and creative learning activities.',
    rating: 4.6,
    reviews: 76,
    rate: 19,
    photo: require('@/assets/images/adult.webp'),
  },
];

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState('');
  const [price, setPrice] = useState('');
  const [selected, setSelected] = useState<Sitter | null>(null);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('2');
  const [childrenCount, setChildrenCount] = useState('1');

  const rate = selected ? selected.rate : 0;
  const total = rate * parseInt(duration || '0');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header showLogo={true} title="Find Babysitter" showBack={true} />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          placeholder="Search sitters"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          style={[styles.search, { backgroundColor: colors.white, color: colors.text }]}
        />

        <Card>
          <Text style={[styles.filtersTitle, { color: colors.text }]}>Filters</Text>
          <View style={styles.filterRow}>
            <Ionicons name="location-sharp" size={20} color={colors.text} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Location"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>
          <View style={styles.filterRow}>
            <Ionicons name="star" size={20} color={colors.text} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Rating (1-5)"
              placeholderTextColor={colors.textSecondary}
              value={rating}
              keyboardType="number-pad"
              onChangeText={setRating}
            />
          </View>
          <View style={styles.filterRow}>
            <Ionicons name="cash" size={20} color={colors.text} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Price range"
              placeholderTextColor={colors.textSecondary}
              value={price}
              onChangeText={setPrice}
            />
          </View>
        </Card>

        {sitters.map((sitter) => (
          <Card key={sitter.id}>
            <View style={styles.sitterCard}>
              <Image source={sitter.photo} style={styles.avatar} />
              <Text style={[styles.name, { color: colors.text }]}>{sitter.name}</Text>
              <Text style={[styles.info, { color: colors.textSecondary }]}>
                {sitter.age} years old
              </Text>
              <Text style={[styles.info, { color: colors.textSecondary }]}>
                {sitter.qualifications}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={20} color="#f4c150" />
                <Text style={[styles.ratingText, { color: colors.text }]}>
                  {sitter.rating} ({sitter.reviews} Reviews)
                </Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.bookButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelected(sitter);
                    setBookingVisible(true);
                  }}
                >
                  <Text style={styles.bookText}>Book</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={bookingVisible} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <Header title="Book Sitter" />
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Book {selected?.name}
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="calendar" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Select Date"
                placeholderTextColor={colors.textSecondary}
                value={date}
                onChangeText={setDate}
              />
            </View>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="time" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Select Time"
                placeholderTextColor={colors.textSecondary}
                value={time}
                onChangeText={setTime}
              />
            </View>
            <View style={[styles.inputRow, { backgroundColor: colors.white }]}>
              <Ionicons name="hourglass" size={20} color={colors.text} style={styles.icon} />
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                placeholder="Duration (hours)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
              />
            </View>
            <Text style={[styles.total, { color: colors.text }]}>Total: ${total}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setBookingVisible(false);
                Alert.alert('Booking confirmed');
              }}
            >
              <Text style={styles.confirmText}>Confirm Booking</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  search: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  filtersTitle: {
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    marginLeft: 10,
  },
  sitterCard: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  info: {
    marginTop: 2,
    fontSize: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingText: {
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  bookButton: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bookText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  icon: {
    marginRight: 6,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 10,
  },
  total: {
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 18,
  },
  confirmButton: {
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
