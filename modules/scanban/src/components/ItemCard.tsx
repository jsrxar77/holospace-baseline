import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

  const cardRadius = theme.radiusCard || (theme.borderRadius === 4 ? 4 : (theme.borderRadius === 12 ? 12 : 32));
  const badgeRadius = theme.radiusBadge || (theme.borderRadius === 4 ? 4 : (theme.borderRadius === 12 ? 20 : 14));

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBg,
          borderColor: isCompleted ? theme.emerald : (isPending ? theme.cardBorder : theme.cobalt),
          borderRadius: cardRadius
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.details}>
        <Text style={[styles.skuText, { color: theme.textMuted }]}>EAN: {item.code}</Text>
        <Text style={[styles.descriptionText, { color: theme.textMain }]} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      <View style={styles.rightGroup}>
        <Text style={[styles.countText, { color: isCompleted ? theme.emerald : theme.textMain }]}>
          {item.quantityScanned} / {item.quantityRequired}
        </Text>
        <View
          style={[
            styles.badge,
            {
              borderRadius: theme.borderRadius === 4 ? 4 : 8,
              borderColor: isCompleted ? theme.emerald : theme.cardBorder,
              backgroundColor: isCompleted ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.05)'
            }
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isCompleted ? theme.emerald : theme.textMuted }
            ]}
          >
            {isCompleted ? 'COMPLETADO' : 'PENDIENTE'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#30363D',
    borderRadius: 20,
    padding: 16,
    minHeight: 88, // Ergonomía industrial > 64px
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  cardCompleted: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.05)'
  },
  cardInProgress: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)'
  },
  details: {
    flex: 1,
    gap: 4
  },
  skuText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  descriptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20
  },
  rightGroup: {
    alignItems: 'flex-end',
    gap: 6
  },
  countText: {
    fontSize: 32, // Giant 32pt font para visibilidad a 1 metro
    fontWeight: '900'
  },
  textCompleted: {
    color: '#00E676'
  },
  textPending: {
    color: '#FFFFFF'
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  badgeCompleted: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: '#00E676'
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  badgeTextCompleted: {
    color: '#00E676'
  },
  badgeTextPending: {
    color: '#F59E0B'
  }
});
