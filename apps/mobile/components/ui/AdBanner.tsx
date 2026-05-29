import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Animated, Linking,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAds } from '../../hooks/useAds';
import { COLORS } from '../../constants';

// Small muted autoplay video thumbnail for the banner strip.
function VideoThumbnail({ uri, isActive }: { uri: string; isActive: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive]);

  return (
    <VideoView
      player={player}
      style={styles.thumbnail}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function AdBanner() {
  const { ads, currentAd, currentIndex, setCurrentIndex } = useAds();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Restart the progress animation each time the active ad changes
  useEffect(() => {
    animationRef.current?.stop();
    progressAnim.setValue(0);
    if (!currentAd) return;

    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: currentAd.durationSeconds * 1000,
      useNativeDriver: false,
    });
    animationRef.current.start();
  }, [currentIndex, currentAd?.id]);

  if (!currentAd) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleTap = () => {
    if (currentAd.targetUrl) Linking.openURL(currentAd.targetUrl).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Ad content row */}
      <TouchableOpacity style={styles.row} activeOpacity={0.88} onPress={handleTap}>
        {/* Thumbnail */}
        {currentAd.type === 'video' ? (
          <VideoThumbnail uri={currentAd.contentUrl} isActive />
        ) : (
          <Image source={{ uri: currentAd.contentUrl }} style={styles.thumbnail} resizeMode="cover" />
        )}

        {/* Copy */}
        <View style={styles.copy}>
          <View style={styles.topRow}>
            <View style={styles.adTag}>
              <Text style={styles.adTagText}>Ad</Text>
            </View>
            {ads.length > 1 && (
              <Text style={styles.counter}>{currentIndex + 1}/{ads.length}</Text>
            )}
          </View>
          <Text style={styles.title} numberOfLines={1}>{currentAd.title}</Text>
          {currentAd.advertiserName ? (
            <Text style={styles.advertiser} numberOfLines={1}>{currentAd.advertiserName}</Text>
          ) : null}
        </View>

        {/* CTA */}
        {currentAd.targetUrl ? (
          <TouchableOpacity style={styles.ctaBtn} onPress={handleTap} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Learn more</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Dot indicators */}
      {ads.length > 1 && (
        <View style={styles.dots}>
          {ads.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setCurrentIndex(i)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Animated progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adTag: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  counter: {
    fontSize: 10,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  advertiser: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    marginBottom: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 14,
    backgroundColor: COLORS.primary,
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
});
