import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { OrderItem } from '../types';
import { useThemeStore } from '../store/useThemeStore';

interface ItemCardProps {
  item: OrderItem;
  onPress?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onPress }) => {
  const { theme } = useThemeStore();
  const isCompleted = item.quantityScanned >= item.quantityRequired;
  const isPending = item.quantityScanned === 0;

  const cardRadius = theme.radiusCard !== undefined ? theme.radiusCard : (theme.borderRadius || 4);
  const badgeRadius = theme.radiusBadge !== undefined ? theme.radiusBadge : (theme.borderRadius || 2);
  const borderWidthVal = theme.borderWidth !== undefined ? theme.borderWidth : 1;
  const fontFamilyMain = theme.fontFamily || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'JetBrains Mono');
  const fontFamilyMono = theme.fontMono || (Platform.OS === 'web' ? '"JetBrains Mono", monospace' : 'monospace');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBg,
          borderColor: isCompleted ? theme.emerald : (isPending ? theme.cardBorder : theme.cobalt),
          borderRadius: cardRadius,
          borderWidth: borderWidthVal
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.details}>
        <Text style={[styles.skuText, { color: theme.textMuted, fontFamily: fontFamilyMono }]}>EAN: {item.code}</Text>
        <Text style={[styles.descriptionText, { color: theme.textMain, fontFamily: fontFamilyMain }]} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <View style={styles.rightGroup}>
        <Text style={[styles.countText, { color: isCompleted ? theme.emerald : theme.textMain, fontFamily: fontFamilyMono }]}>
          {item.quantityScanned} / {item.quantityRequired}
        </Text>
        <View
          style={[
            styles.badge,
            {
              borderRadius: badgeRadius,
              borderWidth: borderWidthVal,
              borderColor: isCompleted ? theme.emerald : (isPending ? theme.cardBorder : theme.cobalt),
              backgroundColor: isCompleted ? `${theme.emerald}20` : (isPending ? `${theme.cardBorder}40` : `${theme.cobalt}20`)
            }
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                fontFamily: fontFamilyMono,
                color: isCompleted ? theme.emerald : (isPending ? theme.textMuted : theme.cobalt)
              }
            ]}
          >
            {isCompleted ? 'LISTO' : (isPending ? 'PENDIENTE' : 'EN CURSO')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  details: {
    flex: 1,
    marginRight: 12,
    gap: 4
  },
  skuText: {
    fontSize: 11,
    fontWeight: '700'
  },
  descriptionText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18
  },
  rightGroup: {
    alignItems: 'flex-end',
    gap: 6
  },
  countText: {
    fontSize: 18,
    fontWeight: '900'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900'
  }
});
