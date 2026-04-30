import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onLocationSelect?: (latitude: number, longitude: number) => void;
}

export default function SearchBar({ onLocationSelect }: Props) {
  const { searchQuery, setSearchQuery } = useMapStore();
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=ph&addressdetails=0`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PerchParkingApp/1.0' },
      });
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 450);
  };

  const handleSelect = (item: NominatimResult) => {
    // Use first comma-segment as the display label in the input
    const label = item.display_name.split(',')[0].trim();
    setSearchQuery(label);
    setSuggestions([]);
    onLocationSelect?.(parseFloat(item.lat), parseFloat(item.lon));
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search area, street or landmark..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={handleChangeText}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={item.place_id}
              style={[styles.suggestion, index < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionIcon}>📍</Text>
              <Text style={styles.suggestionText} numberOfLines={2}>
                {item.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    gap: 8,
  },
  icon: { fontSize: 16 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  clear: { color: COLORS.textSecondary, fontSize: 14, paddingHorizontal: 4 },
  loader: { marginHorizontal: 2 },
  dropdown: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  suggestionIcon: { fontSize: 14, marginTop: 1 },
  suggestionText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
});
