import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Pressable,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
  Switch,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Tooltip from 'react-native-walkthrough-tooltip';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import Modal from 'react-native-modal';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Asset } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import { HeroClass, getClassIcon } from './classIcons';
import levelAbilitiesData from '../../assets/Level-Fähigkeiten.json';
import monstersData from '../../assets/Loot.json';
import heroquestLogo from '../../assets/heroquest_logo.png';
import willkommensBild from '../../assets/Willkommensbild.png';
import inventarBild from '../../assets/Inventar.png';

// Typdefinitionen
type InventoryItem = {
  name: string;
  count: number;
};

type Hero = {
  id: string;
  name: string;
  class: HeroClass;
  level: number;
  attack: number;
  defense: number;
  strength: number;
  intelligence: number;
  mana: number;
  exp: number;
  gold: number;
  glory: number;
  inventory: InventoryItem[];
  highlightFields?: Record<string, boolean>;
};

type Monster = {
  id: string;
  name: string;
  w6: number;
  w20: number;
  guaranteed: string;
  rewards: Record<number, string>;
};

type Loot = {
  id: string;
  hero: Hero;
  monster: Monster;
  w6Rolls: number[];
  w20Rolls: number[];
  w6Sum: number;
  w20Sum: number;
  w6Reward: string;
  w20Reward: string;
};

type RewardAnimationType = {
  type: 'exp' | 'gold' | 'glory' | 'item';
  value?: number;
  item?: string;
  current?: number;
  target: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  hero?: Hero;
};

type RewardAnimationProps = {
  anim: RewardAnimationType;
  onComplete: (anim: RewardAnimationType) => void;
  onValueUpdate?: (update: { type: string; value?: number; item?: string }) => void;
  selectedHero: Hero | null;
  styles: any;
};

type AbilityPerLevel = { [level: string]: string };

type LevelAbilities = {
  expRequired: number;
  ability: string;
};

type ClassAbilities = Record<HeroClass, LevelAbilities[]>;

interface AppSettings {
  animationsDisabled: boolean;
  monsters?: Monster[];
  classAbilities?: ClassAbilities;
  monsterLootFileName?: string;
  classFileName?: string;
  monsterFileUri?: string;
  classFileUri?: string;
}

const DEFAULT_SETTINGS = {
  animationsDisabled: false,
};
const DEFAULT_MONSTER_LOOT_FILE = 'Standardliste: Monster & Belohnungen';
const DEFAULT_CLASS_ABILITIES_FILE = 'Standardliste: Klassen & Fähigkeiten';

const parseClassAbilities = (): ClassAbilities => {
  const abilities: ClassAbilities = {
    Barbar: [],
    Zwerg: [],
    Elfe: [],
    Zauberer: [],
    Ritter: [],
    Schurke: [],
    Mönch: [],
    Hexe: [],
    Barde: [],
    Berserker: [],
    Entdecker: [],
    Druide: [],
    Kleriker: [],
    Nekromant: [],
    Ranger: [],
    Paladin: [],
    Mentor: [],
  };

  const data = levelAbilitiesData.Tabelle1;

  data.forEach((row: any) => {
    const heroClass = row['Heroe'] as HeroClass;
    if (!heroClass || !abilities[heroClass]) return;

    Object.entries(row).forEach(([key, value]) => {
      if (key === 'Heroe' || !value) return;

      const expMatch = key.match(/(\d+)\s*EXP/);
      const expRequired = expMatch ? parseInt(expMatch[1], 10) : 0;

      abilities[heroClass].push({
        expRequired,
        ability: value as string,
      });
    });

    abilities[heroClass].sort((a, b) => a.expRequired - b.expRequired);
  });

  return abilities;
};

const parseClassAbilitiesFromData = (data: any[]): ClassAbilities => {
  const abilities: ClassAbilities = {
    Barbar: [],
    Zwerg: [],
    Elfe: [],
    Zauberer: [],
    Ritter: [],
    Schurke: [],
    Mönch: [],
    Hexe: [],
    Barde: [],
    Berserker: [],
    Entdecker: [],
    Druide: [],
    Kleriker: [],
    Nekromant: [],
    Ranger: [],
    Paladin: [],
    Mentor: [],
  };

  data.forEach((row: any) => {
    const heroClass = row['Heroe'] as HeroClass;
    if (!heroClass || !abilities[heroClass]) return;

    Object.entries(row).forEach(([key, value]) => {
      if (key === 'Heroe' || !value) return;

      const expMatch = key.match(/(\d+)\s*EXP/);
      const expRequired = expMatch ? parseInt(expMatch[1], 10) : 0;

      abilities[heroClass].push({
        expRequired,
        ability: value as string,
      });
    });

    abilities[heroClass].sort((a, b) => a.expRequired - b.expRequired);
  });

  return abilities;
};

export const CLASS_ABILITIES: ClassAbilities = parseClassAbilities();

const calculateLevel = (hero: Hero, abilities: ClassAbilities = CLASS_ABILITIES): number => {
  const heroClass = hero.class || 'Barbar';
  const classAbilities = abilities[heroClass] || [];

  let level = 0;
  for (const ability of classAbilities) {
    if (hero.exp >= ability.expRequired) {
      level++;
    } else {
      break;
    }
  }

  return level;
};

const processInventory = (inventoryString: string): InventoryItem[] => {
  const items = inventoryString
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const itemCounts: Record<string, number> = {};

  items.forEach((item) => {
    const countMatch = item.match(/^(\d+)x\s(.+)$/);
    if (countMatch) {
      const count = parseInt(countMatch[1]);
      const name = countMatch[2].trim();
      if (name) {
        itemCounts[name] = (itemCounts[name] || 0) + count;
      }
    } else if (item) {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    }
  });

  return Object.entries(itemCounts)
    .filter(([name]) => name)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const inventoryToString = (inventory: InventoryItem[]): string => {
  return inventory
    .filter((item) => item?.name)
    .map((item) => (item.count > 1 ? `${item.count}x ${item.name}` : item.name))
    .join(', ');
};

const isWeb = Platform.OS === 'web';

const rollDice = (sides: number, amount: number) =>
  Array.from({ length: amount }, () => Math.floor(Math.random() * sides) + 1);

const getExcelColumnLetter = (col: number) => {
  let temp = '';
  let letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
};

// Styledefinitionen
const getStyles = (isAnimating: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#222',
    },
    welcomeScreen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#222',
    },
    backgroundImage: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      opacity: 1,
    },
    logo: {
      width: '80%',
      maxWidth: 3000,
      height: undefined,
      aspectRatio: 2.5,
      resizeMode: 'contain',
      marginBottom: 300,
    },
    mainContentContainer: {
      flex: 1,
      padding: 10,
      paddingTop: 60,
    },
    column: {
      margin: 5,
      flex: 1,
    },
    listContent: {
      paddingBottom: 20,
      flexGrow: 1,
    },
    columnTitle: {
      fontSize: 20,
      color: '#ecf0f1',
      fontWeight: 'bold',
      textAlign: 'center',
      marginVertical: 10,
      paddingHorizontal: 5,
    },
    listItemContainer: {
      backgroundColor: '#444',
      padding: 10,
      marginBottom: 10,
      borderRadius: 8,
    },
    selectedHeroContainer: {
      backgroundColor: '#666',
    },
    listItem: {
      fontSize: 16,
      color: 'orange',
      fontWeight: 'bold',
    },
    heroStatsText: {
      color: '#ecf0f1',
      fontSize: 12,
      marginVertical: 1,
    },
    heroPointsText: {
      color: '#f39c12',
      fontSize: 12,
      marginVertical: 1,
    },
    heroInventoryText: {
      color: 'lightblue',
      fontSize: 12,
      marginVertical: 1,
    },
    rewardText: {
      color: 'white',
      fontSize: 12,
      marginVertical: 1,
    },
    diceText: {
      color: '#ffcc00',
      fontSize: 12,
      marginVertical: 1,
    },
    button: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      padding: 10,
      marginVertical: 5,
      borderRadius: 5,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'white',
    },
    neutralButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      marginVertical: 5,
      borderColor: 'white',
      borderWidth: 1,
      alignItems: 'center',
    },
    buttonText: {
      color: '#f0f0f0',
      fontWeight: 'bold',
      fontSize: 12,
    },
    heroQuestButtonText: {
      color: '#f1c40f',
      fontWeight: 'bold',
      fontSize: 18,
      textShadowColor: '#e67e22',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 1.5,
    },
    deleteButton: {
      backgroundColor: '#e74c3c',
      padding: 10,
      marginVertical: 5,
      borderRadius: 5,
      alignItems: 'center',
    },
    monsterButton: {
      backgroundColor: 'rgba(255, 99, 71, 0.08)',
      padding: 10,
      borderRadius: 8,
      marginVertical: 5,
      alignItems: 'center',
      borderColor: '#ff6b6b',
      borderWidth: 1,
    },
    monsterText: {
      color: '#ff6b6b',
      fontWeight: 'bold',
      textShadowColor: '#000',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    backButton: {
      backgroundColor: '#FF6347',
      padding: 10,
      borderRadius: 5,
      alignItems: 'center',
      position: 'absolute',
      top: 30,
      right: 20,
      zIndex: 10,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 20,
    },
    modalContent: {
      backgroundColor: 'rgba(51, 51, 51, 0.7)',
      borderRadius: 10,
      padding: 20,
      zIndex: 1,
    },
    input: {
      backgroundColor: '#555',
      color: 'white',
      padding: 10,
      marginBottom: 10,
      borderRadius: 5,
    },
    inventoryInput: {
      backgroundColor: 'rgba(85, 85, 85, 0.6)',
      color: 'white',
      padding: 10,
      minHeight: 100,
      borderRadius: 5,
      marginBottom: 10,
    },
    adjusterButton: {
      backgroundColor: '#888',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 5,
      marginHorizontal: 5,
    },
    adjusterButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    animationOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    modalButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 8,
      marginVertical: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    modalButtonText: {
      color: '#f0f0f0',
      fontWeight: 'bold',
      fontSize: 15,
    },
    neutralButtonText: {
      color: '#e0e0e0',
      fontWeight: 'bold',
      fontSize: 14,
      textAlign: 'center',
    },
    diceResults: {
      marginTop: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 20,
      borderRadius: 10,
    },
    diceResultText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    rewardAnimation: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 10,
      borderRadius: 20,
      zIndex: 1000,
      pointerEvents: 'none',
    },
    rewardAnimationText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      textShadowColor: 'rgba(0,0,0,0.75)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    highlightNew: {
      color: 'lightgreen',
      fontWeight: 'bold',
      backgroundColor: 'rgba(0,255,0,0.1)',
      borderRadius: 3,
      paddingHorizontal: 2,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
      alignItems: 'stretch',
    },
    confirmButton: {
      flex: 1,
      backgroundColor: 'rgba(40, 180, 99, 0.15)',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#2ecc71',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: 'rgba(231, 76, 60, 0.15)',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#e74c3c',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    settingText: {
      color: '#e0e0e0',
      fontSize: 16,
      marginBottom: 5,
    },
    diceContainer: {
      width: 60,
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 10,
    },
    diceFace: {
      fontSize: 30,
    },
    diceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    },
    highlightValue: {
      color: 'lightgreen',
      fontWeight: 'bold',
      backgroundColor: 'rgba(0,255,0,0.2)',
      borderRadius: 3,
      paddingHorizontal: 2,
    },
    searchInput: {
      backgroundColor: '#555',
      color: 'white',
      padding: 10,
      margin: 5,
      borderRadius: 20,
      paddingHorizontal: 15,
    },
    interactionBlocker: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    levelBadge: {
      position: 'absolute',
      right: 10,
      top: 10,
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    levelBadgeBg: {
      position: 'absolute',
      width: '150%',
      height: '150%',
    },
    levelText: {
      color: 'gold',
      fontWeight: 'bold',
      fontSize: 22,
      textShadowColor: 'black',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    classSelection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    classOption: {
      margin: 5,
      padding: 10,
      borderRadius: 5,
      alignItems: 'center',
      backgroundColor: '#444',
      width: 100,
    },
    selectedClass: {
      backgroundColor: '#008CBA',
    },
    classIcon: {
      width: 200,
      height: 70,
    },
    abilitiesModal: {
      backgroundColor: '#333',
      padding: 20,
      borderRadius: 10,
      maxHeight: '80%',
    },
    abilitiesTitle: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 15,
    },
    abilityItem: {
      marginBottom: 10,
      padding: 10,
      backgroundColor: '#444',
      borderRadius: 5,
    },
    abilityLevel: {
      color: 'orange',
      fontWeight: 'bold',
    },
    abilityText: {
      color: 'white',
    },
    noAbilitiesText: {
      color: 'white',
      textAlign: 'center',
      marginTop: 20,
    },
    classText: {
      color: 'white',
      marginTop: 5,
      textAlign: 'center',
    },
    classIconSmall: {
      width: 30,
      height: 30,
      marginRight: 10,
    },
    closeButton: {
      position: 'absolute',
      top: 60,
      right: 30,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 20,
      padding: 15,
    },
    closeButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 20,
    },
  });

// Komponenten
const RewardAnimation = ({
  anim,
  onComplete,
  onValueUpdate,
  selectedHero,
  styles,
}: RewardAnimationProps & { styles: any }) => {
  const [displayValue, setDisplayValue] = useState(anim.current || 0);
  const [opacity, setOpacity] = useState(1);
  const position = useRef({
    x: anim.startX,
    y: anim.startY,
  }).current;

  useEffect(() => {
    let frameId: number;
    let timeoutId: NodeJS.Timeout;
    let completed = false;

    const duration = 1000;
    const startTime = Date.now();
    const startValue = anim.current || 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = Easing.out(Easing.quad)(progress);

      position.x = anim.startX + (anim.endX - anim.startX) * easedProgress;
      position.y = anim.startY + (anim.endY - anim.startY) * easedProgress;

      if (anim.type !== 'item') {
        const newValue = Math.floor(startValue + (anim.target - startValue) * progress);
        setDisplayValue(newValue);
        onValueUpdate?.({
          type: anim.type,
          value: newValue - startValue,
        });
      }

      if (progress === 1) {
        completed = true;
        setOpacity(0);
        timeoutId = setTimeout(() => onComplete(anim), 300);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (timeoutId) clearTimeout(timeoutId);
      if (!completed) onComplete(anim);
    };
  }, [anim.target]);

  if (!selectedHero || anim.hero?.id !== selectedHero.id) return null;

  return (
    <Animated.View
      style={[
        styles.rewardAnimation,
        {
          opacity,
          transform: [{ translateX: position.x }, { translateY: position.y }],
          zIndex: 1000,
        },
      ]}
    >
      <Text style={styles.rewardAnimationText}>
        {anim.type === 'exp'
          ? '⭐'
          : anim.type === 'gold'
            ? '💰'
            : anim.type === 'glory'
              ? '🏆'
              : '🎁'}
        {anim.type !== 'item' ? `+${displayValue}` : anim.item}
      </Text>
    </Animated.View>
  );
};

const LevelBadge = ({
  level,
  onPress,
  styles,
  responsiveStyles,
}: {
  level: number;
  onPress: () => void;
  styles: any;
  responsiveStyles: any;
}) => (
  <TouchableOpacity onPress={onPress} style={[styles.levelBadge, responsiveStyles.levelBadge]}>
    <Image
      source={require('../../assets/level_badge_bg.png')}
      style={[
        styles.levelBadgeBg,
        {
          width: responsiveStyles.levelBadge.width * 1.5,
          height: responsiveStyles.levelBadge.height * 1.5,
        },
      ]}
      resizeMode="contain"
    />
    <Text style={[styles.levelText, responsiveStyles.levelText]}>{level}</Text>
  </TouchableOpacity>
);

const AbilitiesModal = ({
  hero,
  isVisible,
  onClose,
  styles,
  classAbilities,
}: {
  hero: Hero;
  isVisible: boolean;
  onClose: () => void;
  styles: any;
  classAbilities: ClassAbilities;
}) => {
  const heroClass = hero.class || 'Barbar';
  const abilities = classAbilities?.[heroClass] ?? [];

  const currentLevel = calculateLevel(hero, classAbilities);
  const unlockedAbilities = abilities.slice(0, currentLevel).map((ability, index) => ({
    ...ability,
    level: index + 1,
  }));

  return (
    <Modal isVisible={isVisible} onBackdropPress={onClose}>
      <View style={styles.modalContainer}>
        <Text style={styles.columnTitle}>Fähigkeiten von {hero.name}</Text>
        <ScrollView style={{ maxHeight: '80%' }}>
          {unlockedAbilities.length > 0 ? (
            unlockedAbilities.map((ability, index) => (
              <View key={index} style={styles.abilityItem}>
                <Text style={styles.abilityLevel}>Level {ability.level}</Text>
                <Text style={styles.abilityText}>{ability.ability}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noAbilitiesText}>Keine Fähigkeiten freigeschaltet.</Text>
          )}
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Schließen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

type HeroItemProps = {
  item: Hero;
  selectedHero: Hero | null;
  onSelect: (hero: Hero | null) => void;
  onEdit: () => void;
  onInventory: () => void;
  onDelete: () => void;
  highlightFields?: Record<string, boolean>;
  animatingValues?: {
    exp?: number;
    gold?: number;
    glory?: number;
    inventory?: string[];
  };
  isAnimating: boolean;
  styles: any;
  responsiveStyles: any;
  classAbilities: ClassAbilities;
};

const HeroItem = React.forwardRef(
  (
    {
      item,
      selectedHero,
      onSelect,
      onEdit,
      onInventory,
      onDelete,
      highlightFields = {},
      animatingValues,
      isAnimating,
      styles,
      responsiveStyles,
      classAbilities,
    }: HeroItemProps,
    ref: any,
  ) => {
    const [showAbilities, setShowAbilities] = useState(false);
    const heroWithDefaultClass = {
      ...item,
      class: item.class || 'Barbar',
    };
    const currentLevel = calculateLevel(heroWithDefaultClass, classAbilities);
    const shouldAnimate = isAnimating && selectedHero?.id === item.id;

    const displayExp =
      shouldAnimate && animatingValues?.exp !== undefined ? animatingValues.exp : item.exp;
    const displayGold =
      shouldAnimate && animatingValues?.gold !== undefined ? animatingValues.gold : item.gold;
    const displayGlory =
      shouldAnimate && animatingValues?.glory !== undefined ? animatingValues.glory : item.glory;
    const displayInventory =
      shouldAnimate && animatingValues?.inventory !== undefined
        ? animatingValues.inventory
        : item.inventory.map((item) =>
            item.count > 1 ? `${item.count}x ${item.name}` : item.name,
          );

    return (
      <View ref={ref}>
        <TouchableOpacity
          style={[
            styles.listItemContainer,
            selectedHero?.id === item.id && styles.selectedHeroContainer,
          ]}
          onPress={() => onSelect(item.id === selectedHero?.id ? null : item)}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listItem, highlightFields.name && styles.highlightNew]}>
                {item.name} ({heroWithDefaultClass.class})
              </Text>
              <Text style={[styles.heroStatsText, highlightFields.attack && styles.highlightNew]}>
                ⚔ Angriff: {item.attack}
              </Text>
              <Text style={[styles.heroStatsText, highlightFields.defense && styles.highlightNew]}>
                🛡 Verteidigung: {item.defense}
              </Text>
              <Text style={[styles.heroStatsText, highlightFields.strength && styles.highlightNew]}>
                💪 Körperkraft: {item.strength}
              </Text>
              <Text
                style={[styles.heroStatsText, highlightFields.intelligence && styles.highlightNew]}
              >
                🎓 Intelligenz: {item.intelligence}
              </Text>
              <Text style={[styles.heroStatsText, highlightFields.mana && styles.highlightNew]}>
                🔮 Mana: {item.mana}
              </Text>
              <Text style={styles.heroPointsText}>
                ⭐ EXP:{' '}
                <Text style={highlightFields.exp && styles.highlightValue}>{displayExp}</Text>
              </Text>
              <Text style={styles.heroPointsText}>
                💰 Gold:{' '}
                <Text style={highlightFields.gold && styles.highlightValue}>{displayGold}</Text>
              </Text>
              <Text style={styles.heroPointsText}>
                🏆 Ruhmesplättchen:{' '}
                <Text style={highlightFields.glory && styles.highlightValue}>{displayGlory}</Text>
              </Text>
              <Text style={styles.heroInventoryText}>
                📦 Inventar:{' '}
                <Text style={highlightFields.inventory && styles.highlightValue}>
                  {displayInventory.length > 0 ? displayInventory.join(', ') : 'Leer'}
                </Text>
              </Text>
            </View>
            <LevelBadge
              level={currentLevel}
              onPress={() => setShowAbilities(true)}
              styles={styles}
              responsiveStyles={responsiveStyles}
            />

            <View
              style={{
                position: 'absolute',
                top: 20,
                right: -50,
                width: 150,
                height: 150,
                borderRadius: 25,
                overflow: 'hidden',
                backgroundColor: 'transparent',
                zIndex: 5,
              }}
            >
              <Image
                source={getClassIcon(heroWithDefaultClass.class)}
                style={{
                  width: '100%',
                  height: '100%',
                  resizeMode: 'contain',
                }}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={[styles.button, { flex: 1, minWidth: 100, margin: 2 }]}
              onPress={onEdit}
            >
              <Text style={styles.buttonText}>✏️ Bearbeiten</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { flex: 1, minWidth: 100, margin: 2 }]}
              onPress={onInventory}
            >
              <Text style={styles.buttonText}>📦 Inventar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, { flex: 1, minWidth: 100, margin: 2 }]}
              onPress={onDelete}
            >
              <Text style={styles.buttonText}>🗑️ Löschen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <AbilitiesModal
          hero={heroWithDefaultClass}
          isVisible={showAbilities}
          onClose={() => setShowAbilities(false)}
          styles={styles}
          classAbilities={classAbilities}
        />
      </View>
    );
  },
);

const RewardItem = ({ item, styles }: { item: Loot; styles: any }) => (
  <View style={styles.listItemContainer}>
    {item.monster.guaranteed !== 'Keine Belohnung' && (
      <Text style={styles.rewardText}>🎯 {item.monster.guaranteed}</Text>
    )}
    {item.monster.w6 > 0 && (
      <>
        <Text style={styles.diceText}>🎲 W6: {item.w6Rolls.join(', ')}</Text>
        {item.w6Reward !== 'Keine Belohnung (W6)' && (
          <Text style={styles.rewardText}>➡️ {item.w6Reward}</Text>
        )}
      </>
    )}
    {item.monster.w20 > 0 && (
      <>
        <Text style={styles.diceText}>🎲 W20: {item.w20Rolls.join(', ')}</Text>
        {item.w20Reward !== 'Keine Belohnung (W20)' && (
          <Text style={styles.rewardText}>➡️ {item.w20Reward}</Text>
        )}
      </>
    )}
  </View>
);

const MonsterButton = ({
  item,
  selectedHero,
  onDefeat,
  isAnimating,
  styles,
}: {
  item: Monster;
  selectedHero: Hero | null;
  onDefeat: (monster: Monster) => void;
  isAnimating: boolean;
  styles: any;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.95))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={() => selectedHero && !isAnimating && onDefeat(item)}
      disabled={!selectedHero || isAnimating}
    >
      <Animated.View
        style={[
          styles.monsterButton,
          animatedStyle,
          (!selectedHero || isAnimating) && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.monsterText}>{item.name} ⚔</Text>
      </Animated.View>
    </Pressable>
  );
};

const globalStyles = StyleSheet.create({
  zoomedImageContainer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderRadius: 10,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    padding: 10,
    zIndex: 10,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  tooltipContainer: {
    padding: 8,
    backgroundColor: '#222',
    borderRadius: 6,
    alignItems: 'center',
  },
  tooltipText: {
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipImage: {
    width: '100%',
    maxWidth: '100%',
    aspectRatio: 15,
    resizeMode: 'contain',
    borderRadius: 4,
  },
});

interface ImageZoomModalProps {
  visible: boolean;
  imageSource: ImageSourcePropType;
  onClose: () => void;
}

const ImageZoomModal = ({
  visible,
  imageSource,
  onClose,
}: {
  visible: boolean;
  imageSource: ImageSourcePropType | null;
  onClose: () => void;
}) => {
  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.9)',
    },
    image: {
      width: '100%',
      height: '80%',
      resizeMode: 'contain',
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 20,
      padding: 10,
    },
    closeText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
  });

  if (!visible || !imageSource) return null;

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={{ margin: 0 }}>
      <View style={styles.modalContainer}>
        <Image source={imageSource} style={styles.image} />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Schließen</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// Hauptkomponente
export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const { width, height } = useWindowDimensions();
  const [welcomeScreen, setWelcomeScreen] = useState(true);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [monsterLootFileName, setMonsterLootFileName] = useState(DEFAULT_MONSTER_LOOT_FILE);
  const [classFileName, setClassFileName] = useState(DEFAULT_CLASS_ABILITIES_FILE);
  const [classAbilities, setClassAbilities] = useState<ClassAbilities>(CLASS_ABILITIES);
  const [defeatedMonsters, setDefeatedMonsters] = useState<Loot[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [editableInventory, setEditableInventory] = useState<string>('');
  const [newHero, setNewHero] = useState<Partial<Hero>>({});
  const [plusInputs, setPlusInputs] = useState<Record<string, string>>({});
  const [minusInputs, setMinusInputs] = useState<Record<string, string>>({});
  const [zoomedImage, setZoomedImage] = useState<ImageSourcePropType | null>(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [showDiceAnimation, setShowDiceAnimation] = useState(false);
  const [diceRolls, setDiceRolls] = useState<{ w6: number[]; w20: number[] } | null>(null);
  const [rewardAnimations, setRewardAnimations] = useState<RewardAnimationType[]>([]);
  const rotation = useSharedValue(0);
  const [showDice, setShowDice] = useState(false);
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const heroRef = useRef<View>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [heroSearchTerm, setHeroSearchTerm] = useState('');
  const [monsterSearchTerm, setMonsterSearchTerm] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [startValues, setStartValues] = useState({ exp: 0, gold: 0, glory: 0 });
  const [animatingValues, setAnimatingValues] = useState<{
    exp?: number;
    gold?: number;
    glory?: number;
    inventory?: string[];
  }>({});
  const styles = getStyles(isAnimating);

  const [showTooltipMonster, setShowTooltipMonster] = useState(false);
  const [showTooltipClass, setShowTooltipClass] = useState(false);

  // When opening:
  const handleImagePress = () => {
    setZoomVisible(true);
  };

  // When closing:
  const handleClose = () => {
    setZoomVisible(false);
  };

  useEffect(() => {
    return () => {
      setZoomVisible(false);
    };
  }, []);

  const getResponsiveStyles = (width: number) => {
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isLargeTablet = width >= 1024 && width < 1280;
    const isDesktop = width >= 1280;

    return StyleSheet.create({
      mainContentContainer: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        height: isMobile ? 'auto' : '85%',
        paddingHorizontal: isMobile ? 5 : 10,
      },
      column: {
        width: isMobile ? Math.min(width * 0.6, 400) : 350,
        minWidth: isMobile ? Math.min(width * 0.5, 400) : 350,
        margin: isMobile ? 3 : 5,
        height: '100%',
      },
      diceFace: {
        fontSize: isMobile ? 30 : 40,
      },
      welcomeImage: {
        width: isMobile ? '100%' : '100%',
        height: isMobile ? '50%' : '100%',
        resizeMode: 'contain',
      },
      flatListContainer: {
        height: '100%',
        minHeight: 400,
      },
      inventarImage: {
        width: isMobile ? '140%' : '100%',
        height: isMobile ? '155%' : '100%',
        resizeMode: 'contain',
        opacity: 1,
        position: 'absolute',
        alignSelf: 'center',
        top: isMobile ? '-25%' : 0,
      },
      levelBadge: {
        position: 'absolute',
        right: isMobile ? 5 : 10,
        top: isMobile ? 5 : 6,
        width: isMobile ? 40 : 50,
        height: isMobile ? 40 : 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      },
      levelText: {
        color: 'gold',
        fontWeight: 'bold',
        fontSize: isMobile ? 20 : 25,
        textShadowColor: 'black',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
      },
      classIconSmall: {
        width: 30,
        height: 30,
        marginRight: 12,
        marginTop: 4,
        marginLeft: 0,
        position: 'relative',
        top: 2,
      },
      heroListItem: {
        fontSize: isMobile ? 14 : 16,
        color: 'orange',
        fontWeight: 'bold',
      },
      heroStatsText: {
        color: '#ecf0f1',
        fontSize: isMobile ? 10 : 12,
        marginVertical: 1,
      },
      heroPointsText: {
        color: '#f39c12',
        fontSize: isMobile ? 10 : 12,
        marginVertical: 1,
      },
      heroInventoryText: {
        color: 'lightblue',
        fontSize: 12,
        marginVertical: 1,
        flexWrap: 'wrap',
        flexShrink: 1,
        maxWidth: '100%',
      },
      modalContent: {
        width: isMobile ? '90%' : isTablet ? '70%' : isLargeTablet ? '60%' : '50%',
        maxHeight: isMobile ? '70%' : '80%',
      },
      inventoryInput: {
        minHeight: isMobile ? 100 : isTablet ? 150 : 200,
      },
      zoomedImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.95)',
      },
      zoomedImage: {
        width: '100%',
        height: undefined,
        aspectRatio: 1,
        resizeMode: 'contain',
      },
      closeButton: {
        position: 'absolute',
        top: isMobile ? 40 : 60,
        right: isMobile ? 20 : 30,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 20,
        padding: isMobile ? 10 : 15,
      },
      closeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: isMobile ? 18 : 20,
      },
    });
  };

  const responsiveStyles = getResponsiveStyles(width);

  useEffect(() => {
    console.log('Current newHero state:', newHero);
  }, [newHero]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedHeroes = await loadHeroes();
        if (savedHeroes) setHeroes(savedHeroes);

        console.log(
          'MonsterLootFileName (vor load):',
          await AsyncStorage.getItem('monsterLootFileName'),
        );
        console.log(
          'ClassFileName (vor load):',
          await AsyncStorage.getItem('classAbilitiesFileName'),
        );

        await loadMonsterData();
        await loadClassData();

        setOriginalSettings((prev) => settings);
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
        console.log('Falle zurück auf Standarddaten');

        const fallbackMonsters = processMonsterData(monstersData.Tabelle1);

        setMonsters(fallbackMonsters);
        setClassAbilities(CLASS_ABILITIES);
        setMonsterLootFileName(DEFAULT_MONSTER_LOOT_FILE);
        setClassFileName(DEFAULT_CLASS_ABILITIES_FILE);

        setSettings((prev) => ({
          ...prev,
          monsters: fallbackMonsters,
          classAbilities: CLASS_ABILITIES,
          monsterLootFileName: DEFAULT_MONSTER_LOOT_FILE,
          classFileName: DEFAULT_CLASS_ABILITIES_FILE,
        }));

        setOriginalSettings((prev) => ({
          ...prev,
          monsters: fallbackMonsters,
          classAbilities: CLASS_ABILITIES,
          monsterLootFileName: DEFAULT_MONSTER_LOOT_FILE,
          classFileName: DEFAULT_CLASS_ABILITIES_FILE,
        }));
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (selectedHero && !isAnimating) {
      setStartValues({
        exp: selectedHero.exp,
        gold: selectedHero.gold,
        glory: selectedHero.glory,
      });
    }
  }, [selectedHero, isAnimating]);

  const saveHeroes = async (heroes: Hero[]) => {
    try {
      await AsyncStorage.setItem('heroes', JSON.stringify(heroes));
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const downloadAndShareTemplate = async (url: string, fileName: string) => {
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const fileUri = FileSystem.documentDirectory + fileName;
      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri);
      await downloadResumable.downloadAsync();
      await Sharing.shareAsync(fileUri);
    }
  };

  const loadHeroes = async () => {
    try {
      const saved = await AsyncStorage.getItem('heroes');
      const heroes = saved ? JSON.parse(saved) : [];

      return heroes.map((hero: any) => ({
        id: hero.id || Date.now().toString(),
        name: hero.name || 'Unbekannt',
        class: hero.class || 'Barbar',
        level: hero.level || 0,
        attack: hero.attack || 0,
        defense: hero.defense || 0,
        strength: hero.strength || 0,
        intelligence: hero.intelligence || 0,
        mana: hero.mana || 0,
        exp: hero.exp || 0,
        gold: hero.gold || 0,
        glory: hero.glory || 0,
        inventory: hero.inventory || [],
      }));
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      return [];
    }
  };

  const loadGameData = async () => {
    try {
      const savedHeroes = await loadHeroes();
      setHeroes(savedHeroes || []);

      try {
        await loadMonsterData();
      } catch (monsterError) {
        console.error('Error loading monster data:', monsterError);
        setMonsters(
          monstersData.Tabelle1.map((item, index) => ({
            id: `${item.Monster}-${index}`,
            name: item.Monster,
            w6: item.W6,
            w20: item.W20,
            guaranteed: item['Garantierte Belohnung'],
            rewards: Object.fromEntries(
              Array.from({ length: 20 }, (_, i) => [i + 1, item[i + 1] || '']),
            ),
          })),
        );
      }

      try {
        await loadClassData();
      } catch (classError) {
        console.error('Error loading class data:', classError);
        setClassAbilities(CLASS_ABILITIES);
      }

      setWelcomeScreen(false);
    } catch (error) {
      console.error('Error loading game data:', error);
      Alert.alert('Error', 'Failed to load game data. Using default data.');
      loadDefaultData();
    }
  };

  const loadMonsterData = async () => {
    try {
      const monsterFileUri = await AsyncStorage.getItem('monsterLootFile');
      const monsterFileName = await AsyncStorage.getItem('monsterLootFileName');

      const monstersAlreadySet = settings.monsters && settings.monsters.length > 0;

      if (monstersAlreadySet) {
        console.log('🛑 Monsterliste bereits gesetzt – lade nichts neu.');
        return;
      }

      let monstersToLoad: Monster[] = [];

      if (monsterFileUri && monsterFileName) {
        if (Platform.OS === 'web') {
          const response = await fetch(monsterFileUri);
          const fileData = await response.arrayBuffer();
          const workbook = XLSX.read(fileData, { type: 'array' });
          const parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          monstersToLoad = processMonsterData(parsedData);
        } else {
          monstersToLoad = await loadCustomMonsterData(monsterFileUri, monsterFileName);
        }

        console.log('✅ Benutzerdefinierte Monster geladen:', monstersToLoad.length);

        setMonsters(monstersToLoad);
        setMonsterLootFileName(monsterFileName);
        setSettings((prev) => ({
          ...prev,
          monsters: monstersToLoad,
          monsterLootFileName: monsterFileName,
          monsterFileUri,
        }));
      } else {
        console.warn('⚠️ Keine gespeicherte Monsterdatei – nutze Standardliste.');

        monstersToLoad = processMonsterData(monstersData.Tabelle1);
        setMonsters(monstersToLoad);
        setMonsterLootFileName(DEFAULT_MONSTER_LOOT_FILE);
        setSettings((prev) => ({
          ...prev,
          monsters: monstersToLoad,
          monsterLootFileName: DEFAULT_MONSTER_LOOT_FILE,
          monsterFileUri: '',
        }));
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Monsterdatei:', error);

      if (!settings.monsters || settings.monsters.length === 0) {
        const fallback = processMonsterData(monstersData.Tabelle1);
        setMonsters(fallback);
        setMonsterLootFileName(DEFAULT_MONSTER_LOOT_FILE);
        setSettings((prev) => ({
          ...prev,
          monsters: fallback,
          monsterLootFileName: DEFAULT_MONSTER_LOOT_FILE,
          monsterFileUri: '',
        }));
      } else {
        console.warn('🔁 Behalte aktuelle Monster bei – kein Reset.');
      }
    }
  };

  const loadClassData = async () => {
    try {
      const classFileUri = await AsyncStorage.getItem('classAbilitiesFile');
      const classFileName = await AsyncStorage.getItem('classAbilitiesFileName');

      if (!classFileUri || !classFileName) {
        console.warn('⚠️ Keine Klassendatei gefunden – überspringe Laden.');
        return;
      }

      let parsedData;

      if (Platform.OS === 'web') {
        const response = await fetch(classFileUri);
        const fileData = await response.arrayBuffer();
        const workbook = XLSX.read(fileData, { type: 'array' });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      } else {
        const fileType = classFileName.split('.').pop()?.toLowerCase();
        const fileData = await FileSystem.readAsStringAsync(
          classFileUri,
          fileType === 'json' ? undefined : { encoding: FileSystem.EncodingType.Base64 },
        );

        if (fileType === 'json') {
          parsedData = JSON.parse(fileData);
        } else {
          const workbook = XLSX.read(fileData, {
            type: fileType === 'xlsx' ? 'base64' : 'binary',
          });
          parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }
      }

      const newClassAbilities = validateAndParseClassData(parsedData);

      setSettings((prev) => ({
        ...prev,
        classAbilities: newClassAbilities,
        classFileName: classFileName,
      }));
    } catch (error) {
      console.error('❌ Fehler beim Laden der Klassendaten:', error);

      if (
        !originalSettings.classAbilities ||
        Object.keys(originalSettings.classAbilities).length === 0
      ) {
        setSettings((prev) => ({
          ...prev,
          classAbilities: CLASS_ABILITIES,
          classFileName: DEFAULT_CLASS_ABILITIES_FILE,
        }));
      }
    }
  };

  const loadCustomMonsterData = async (fileUri: string, fileName: string) => {
    try {
      const fileType = fileName.split('.').pop()?.toLowerCase();
      const fileData = await FileSystem.readAsStringAsync(
        fileUri,
        fileType === 'json' ? undefined : { encoding: FileSystem.EncodingType.Base64 },
      );

      let parsedData;
      if (fileType === 'json') {
        parsedData = JSON.parse(fileData);
      } else {
        const workbook = XLSX.read(fileData, { type: fileType === 'xlsx' ? 'base64' : 'binary' });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      }

      return processMonsterData(parsedData);
    } catch (error) {
      console.error('Fehler beim Laden der Monsterdatei:', error);
      throw error;
    }
  };

  const processMonsterData = (data: any[]): Monster[] => {
    return data.map((item: any, index: number) => ({
      id: `${item.Monster || item.monster || index}`,
      name: item.Monster || item.monster || `Monster ${index}`,
      w6: parseInt(item.W6 || item.w6 || 0),
      w20: parseInt(item.W20 || item.w20 || 0),
      guaranteed: item['Garantierte Belohnung'] || item.guaranteed || 'Keine Belohnung',
      rewards: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          i + 1,
          item[(i + 1).toString()] || item[`Würfel ${i + 1}`] || '',
        ]),
      ),
    }));
  };

  const loadDefaultData = async () => {
    try {
      console.log('Lade Standard-Monsterdaten...');

      if (!monstersData?.Tabelle1) {
        throw new Error('Monsterdaten-Struktur nicht gefunden');
      }

      const defaultMonsters = monstersData.Tabelle1.map((item: any, index: number) => ({
        id: `${item.Monster}-${index}`,
        name: item.Monster || `Monster ${index}`,
        w6: item.W6 || 0,
        w20: item.W20 || 0,
        guaranteed: item['Garantierte Belohnung'] || 'Keine Belohnung',
        rewards: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [
            i + 1,
            item[i + 1] || item[`Würfel ${i + 1}`] || '',
          ]),
        ),
      }));

      console.log('Standard-Monster geladen:', defaultMonsters);
      setMonsters(defaultMonsters);
      setMonsterLootFileName(DEFAULT_MONSTER_LOOT_FILE);
      setWelcomeScreen(false);
    } catch (error) {
      console.error('Fehler beim Laden der Standard-Monster:', error);
      Alert.alert('Fehler', 'Standard-Monster konnten nicht geladen werden');
      setMonsters([]);
    }
  };

  const handleLoadMonsterLootFile = async () => {
    try {
      let result;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.json';

        result = await new Promise<any>((resolve) => {
          input.onchange = (e: any) => {
            const file = e.target.files[0];
            resolve({
              assets: [
                {
                  uri: URL.createObjectURL(file),
                  name: file.name,
                  file: file,
                },
              ],
            });
          };
          input.click();
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
          ],
        });
      }

      if (!result.assets || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      const fileName = result.assets[0].name;

      let monstersToLoad;

      if (Platform.OS === 'web') {
        const file = result.assets[0].file;
        const fileData = await file.arrayBuffer();
        const workbook = XLSX.read(fileData, { type: 'array' });
        const parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        monstersToLoad = processMonsterData(parsedData);
      } else {
        const fileType = fileName.split('.').pop()?.toLowerCase();
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding:
            fileType === 'json' ? FileSystem.EncodingType.UTF8 : FileSystem.EncodingType.Base64,
        });

        if (fileType === 'json') {
          monstersToLoad = processMonsterData(JSON.parse(fileContent));
        } else {
          const workbook = XLSX.read(fileContent, { type: 'base64' });
          monstersToLoad = processMonsterData(
            XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]),
          );
        }
      }

      setSettings((prev) => ({
        ...prev,
        monsters: monstersToLoad,
        monsterLootFileName: fileName,
      }));

      Alert.alert('Erfolg', 'Monsterliste wurde geladen!');
    } catch (error) {
      console.error('Fehler beim Laden der Monsterliste:', error);
      Alert.alert('Fehler', 'Datei konnte nicht geladen werden.');
    }
  };

  const resetMonsterLootFile = async () => {
    try {
      await AsyncStorage.removeItem('monsterLootFile');
      await AsyncStorage.removeItem('monsterLootFileName');

      const standardMonster = monstersData.Tabelle1.map((item, index) => ({
        id: `${item.Monster}-${index}`,
        name: item.Monster,
        w6: item.W6,
        w20: item.W20,
        guaranteed: item['Garantierte Belohnung'],
        rewards: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [i + 1, item[i + 1] || '']),
        ),
      }));

      setSettings((prev) => ({
        ...prev,
        monsters: standardMonster,
        monsterLootFileName: DEFAULT_MONSTER_LOOT_FILE,
      }));

      Alert.alert('Hinweis', 'Standard-Monsterliste vorgemerkt. Bitte „Speichern" drücken.');
    } catch (error) {
      console.error('Fehler beim Zurücksetzen der Monsterliste:', error);
      Alert.alert('Fehler', 'Monsterliste konnte nicht zurückgesetzt werden');
    }
  };

  const handleLoadClassFile = async () => {
    try {
      let result;

      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.json';

        result = await new Promise<any>((resolve) => {
          input.onchange = (e: any) => {
            const file = e.target.files[0];
            resolve({
              assets: [
                {
                  uri: URL.createObjectURL(file),
                  name: file.name,
                },
              ],
            });
          };
          input.click();
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
          ],
        });
      }

      if (!result.assets || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      const fileName = result.assets[0].name;

      let parsedData;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const fileData = await response.arrayBuffer();
        const workbook = XLSX.read(fileData, { type: 'array' });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      } else {
        const fileType = fileName.split('.').pop()?.toLowerCase();
        const fileData = await FileSystem.readAsStringAsync(
          uri,
          fileType === 'json' ? undefined : { encoding: FileSystem.EncodingType.Base64 },
        );

        if (fileType === 'json') {
          parsedData = JSON.parse(fileData);
        } else {
          const workbook = XLSX.read(fileData, { type: fileType === 'xlsx' ? 'base64' : 'binary' });
          parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }
      }

      console.log('Parsierte Klassendaten:', parsedData);

      const newClassAbilities = validateAndParseClassData(parsedData);

      await AsyncStorage.setItem('classAbilitiesFile', uri);
      await AsyncStorage.setItem('classAbilitiesFileName', fileName);

      setSettings((prev) => ({
        ...prev,
        classAbilities: newClassAbilities,
        classFileName: fileName,
      }));

      Alert.alert(
        'Erfolg',
        'Klassenliste wurde vorübergehend geladen. Bitte speichern, um zu übernehmen.',
      );
    } catch (error) {
      console.error('Fehler beim Laden der Klassendatei:', error);
      Alert.alert(
        'Fehler',
        'Die Klassendatei konnte nicht geladen werden oder hat ein ungültiges Format.',
      );
    }
  };

  const validateAndParseClassData = (data: any[]): ClassAbilities => {
    const validClasses = Object.keys(CLASS_ABILITIES);
    const newAbilities: ClassAbilities = { ...CLASS_ABILITIES };

    Object.keys(newAbilities).forEach((cls) => {
      newAbilities[cls as HeroClass] = [];
    });

    data.forEach((row: any) => {
      const heroClass = row['Heroe'] as HeroClass;
      if (!heroClass || !validClasses.includes(heroClass)) return;

      Object.entries(row).forEach(([key, value]) => {
        if (key === 'Heroe' || !value) return;

        const expMatch = key.match(/(\d+)\s*EXP/);
        const expRequired = expMatch ? parseInt(expMatch[1], 10) : 0;

        if (expRequired > 0 && typeof value === 'string') {
          newAbilities[heroClass].push({
            expRequired,
            ability: value,
          });
        }
      });

      newAbilities[heroClass].sort((a, b) => a.expRequired - b.expRequired);
    });

    return newAbilities;
  };

  const resetClassFile = async () => {
    try {
      await AsyncStorage.removeItem('classAbilitiesFile');
      await AsyncStorage.removeItem('classAbilitiesFileName');

      setSettings((prev) => ({
        ...prev,
        classAbilities: CLASS_ABILITIES,
        classFileName: DEFAULT_CLASS_ABILITIES_FILE,
      }));

      Alert.alert('Hinweis', 'Standard-Klassenliste vorgemerkt. Bitte „Speichern" drücken.');
    } catch (error) {
      console.error('Fehler beim Zurücksetzen der Klassendatei:', error);
      Alert.alert('Fehler', 'Klassenliste konnte nicht zurückgesetzt werden');
    }
  };

  const renderDiceFaces = (monster: Monster) => {
    if (!monster || settings.animationsDisabled) return null;

    const diceElements = [];

    for (let i = 0; i < monster.w6; i++) {
      diceElements.push(
        <Animated.View key={`w6-${i}`} style={[styles.diceContainer, diceAnimationStyle]}>
          <Text style={[styles.diceFace, responsiveStyles.diceFace]}>
            {showDice ? '🎲' : diceRolls?.w6[i] ? `⚀⚁⚂⚃⚄⚅`[diceRolls.w6[i] - 1] : ''}
          </Text>
        </Animated.View>,
      );
    }

    for (let i = 0; i < monster.w20; i++) {
      diceElements.push(
        <Animated.View key={`w20-${i}`} style={[styles.diceContainer, diceAnimationStyle]}>
          <Text style={[styles.diceFace, responsiveStyles.diceFace]}>
            {showDice ? '🔮' : diceRolls?.w20[i] || ''}
          </Text>
        </Animated.View>,
      );
    }

    return <View style={styles.diceRow}>{diceElements}</View>;
  };

  const calculateRewardUpdates = (hero: Hero, rewards: string[]) => {
    const rewardUpdates = {
      exp: 0,
      gold: 0,
      glory: 0,
      items: [] as InventoryItem[],
    };

    rewards.forEach((reward) => {
      if (!reward || reward.includes('Keine Belohnung')) return;

      const expMatch = reward.match(/(\d+)\s*EXP/i);
      const goldMatch = reward.match(/(\d+)\s*Gold/i);
      const gloryMatch = reward.match(/(\d+)?\s*Ruhm(?:esplättchen)?/i);

      if (expMatch) rewardUpdates.exp += parseInt(expMatch[1]);
      if (goldMatch) rewardUpdates.gold += parseInt(goldMatch[1]);
      if (gloryMatch) rewardUpdates.glory += gloryMatch[1] ? parseInt(gloryMatch[1]) : 1;

      if (!expMatch && !goldMatch && !gloryMatch) {
        const cleanItem = reward.trim();
        if (cleanItem) {
          const countMatch = cleanItem.match(/^(\d+)x\s(.+)$/);
          const count = countMatch ? parseInt(countMatch[1]) : 1;
          const name = countMatch ? countMatch[2].trim() : cleanItem;

          if (name) {
            const existingItem = rewardUpdates.items.find((item) => item.name === name);
            if (existingItem) {
              existingItem.count += count;
            } else {
              rewardUpdates.items.push({ name, count });
            }
          }
        }
      }
    });

    return rewardUpdates;
  };

  const handleDefeatMonster = async (monster: Monster) => {
    if (!selectedHero || isAnimating) return;

    try {
      setIsAnimating(true);
      setSelectedMonster(monster);
      setStartValues({
        exp: selectedHero.exp,
        gold: selectedHero.gold,
        glory: selectedHero.glory,
      });
      setAnimatingValues({});

      const w6Rolls = rollDice(6, monster.w6);
      const w20Rolls = rollDice(20, monster.w20);
      const w6Sum = w6Rolls.reduce((sum, roll) => sum + roll, 0);
      const w20Sum = w20Rolls.reduce((sum, roll) => sum + roll, 0);

      const loot: Loot = {
        id: `${monster.id}-${Date.now()}`,
        hero: selectedHero,
        monster,
        w6Rolls,
        w20Rolls,
        w6Sum,
        w20Sum,
        w6Reward: monster.rewards[w6Sum] || 'Keine Belohnung (W6)',
        w20Reward: monster.rewards[w20Sum] || 'Keine Belohnung (W20)',
      };

      const rewards = [monster.guaranteed, loot.w6Reward, loot.w20Reward].filter(
        (reward) => reward && !reward.includes('Keine Belohnung'),
      );

      const rewardUpdates = calculateRewardUpdates(selectedHero, rewards);

      if (settings.animationsDisabled) {
        const updatedHero = {
          ...selectedHero,
          exp: selectedHero.exp + rewardUpdates.exp,
          gold: selectedHero.gold + rewardUpdates.gold,
          glory: selectedHero.glory + rewardUpdates.glory,
          inventory: [...selectedHero.inventory, ...rewardUpdates.items]
            .filter((item) => item?.name)
            .sort((a, b) => a.name.localeCompare(b.name)),
        };

        const updatedHeroes = heroes.map((h) => (h.id === updatedHero.id ? updatedHero : h));

        setHeroes(updatedHeroes);
        setSelectedHero(updatedHero);
        setDefeatedMonsters((prev) => [loot, ...prev]);
        await saveHeroes(updatedHeroes);

        setTimeout(() => {
          setHeroes((prev) =>
            prev.map((h) => (h.id === selectedHero.id ? { ...h, highlightFields: {} } : h)),
          );
          setIsAnimating(false);
        }, 1000);
        return;
      }

      setShowDiceAnimation(true);
      setDiceRolls(null);
      setShowDice(true);
      rotation.value = 0;

      rotation.value = withTiming(360 * 5, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setDiceRolls({ w6: w6Rolls, w20: w20Rolls });
      setShowDice(false);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowDiceAnimation(false);
      rotation.value = 0;

      setDefeatedMonsters((prev) => [loot, ...prev]);

      let endX = width / 2;
      let endY = height / 2;

      if (heroRef.current) {
        if (Platform.OS === 'web') {
          const rect = heroRef.current.getBoundingClientRect();
          endX = rect.left + rect.width / 2;
          endY = rect.top + rect.height / 2;
        } else {
          const node = findNodeHandle(heroRef.current);
          if (node) {
            await new Promise<void>((resolve) => {
              UIManager.measure(node, (x, y, w, h, px, py) => {
                endX = px + w / 2;
                endY = py + h / 2;
                resolve();
              });
            });
          }
        }
      }

      const highlightFields = {
        exp: rewardUpdates.exp > 0,
        gold: rewardUpdates.gold > 0,
        glory: rewardUpdates.glory > 0,
        inventory: rewardUpdates.items.length > 0,
      };
      setHeroes((prev) =>
        prev.map((h) => (h.id === selectedHero.id ? { ...h, highlightFields } : h)),
      );

      const animations: RewardAnimationType[] = [];
      const currentHero = selectedHero;

      if (rewardUpdates.exp > 0) {
        animations.push({
          type: 'exp',
          current: currentHero.exp,
          target: currentHero.exp + rewardUpdates.exp,
          startX: width / 2,
          startY: height / 2,
          endX,
          endY,
          hero: currentHero,
        });
      }

      if (rewardUpdates.gold > 0) {
        animations.push({
          type: 'gold',
          current: currentHero.gold,
          target: currentHero.gold + rewardUpdates.gold,
          startX: width / 2,
          startY: height / 2,
          endX,
          endY,
          hero: currentHero,
        });
      }

      if (rewardUpdates.glory > 0) {
        animations.push({
          type: 'glory',
          current: currentHero.glory,
          target: currentHero.glory + rewardUpdates.glory,
          startX: width / 2,
          startY: height / 2,
          endX,
          endY,
          hero: currentHero,
        });
      }

      rewardUpdates.items.forEach((item) => {
        animations.push({
          type: 'item',
          item: item.count > 1 ? `${item.count}x ${item.name}` : item.name,
          startX: width / 2,
          startY: height / 2,
          endX,
          endY,
          target: 0,
          hero: currentHero,
        });
      });

      setRewardAnimations(animations);

      setTimeout(() => {
        setIsAnimating(false);
        setHeroes((prev) =>
          prev.map((h) => (h.id === selectedHero.id ? { ...h, highlightFields: {} } : h)),
        );
      }, 1500);
    } catch (error) {
      console.error('Fehler beim Monster besiegen:', error);
      setIsAnimating(false);
      setShowDiceAnimation(false);
      setSelectedMonster(null);
      setRewardAnimations([]);
      setHeroes((prev) =>
        prev.map((h) => (h.id === selectedHero.id ? { ...h, highlightFields: {} } : h)),
      );
    }
  };

  const addRewardToHero = (anim: RewardAnimationType) => {
    setHeroes((prevHeroes) => {
      const updatedHeroes = prevHeroes.map((hero) => {
        if (hero.id !== anim.hero?.id) return hero;

        const updatedHero = { ...hero };

        switch (anim.type) {
          case 'exp':
            updatedHero.exp = anim.target;
            break;
          case 'gold':
            updatedHero.gold = anim.target;
            break;
          case 'glory':
            updatedHero.glory = anim.target;
            break;
          case 'item':
            if (anim.item) {
              const countMatch = anim.item.match(/^(\d+)x\s(.+)$/);
              const count = countMatch ? parseInt(countMatch[1]) : 1;
              const name = countMatch ? countMatch[2].trim() : anim.item.trim();

              if (name) {
                const existingItemIndex = updatedHero.inventory.findIndex(
                  (item) => item?.name === name,
                );

                if (existingItemIndex >= 0) {
                  updatedHero.inventory[existingItemIndex].count += count;
                } else {
                  updatedHero.inventory.push({ name, count });
                }

                updatedHero.inventory = updatedHero.inventory
                  .filter((item) => item?.name && item.count > 0)
                  .sort((a, b) => a.name.localeCompare(b.name));
              }
            }
            break;
        }

        return updatedHero;
      });

      if (selectedHero?.id === anim.hero?.id) {
        const updatedHero = updatedHeroes.find((h) => h.id === anim.hero?.id);
        if (updatedHero) {
          setSelectedHero(updatedHero);
        }
      }

      saveHeroes(updatedHeroes);
      return updatedHeroes;
    });

    if (anim.type !== 'item') {
      setStartValues((prev) => ({
        ...prev,
        [anim.type]: anim.target,
      }));
    }
  };

  const handleValueUpdate = ({
    type,
    value,
    item,
  }: {
    type: string;
    value?: number;
    item?: string;
  }) => {
    if (!type || !selectedHero) return;

    setAnimatingValues((prev) => {
      const update = { ...prev };

      if (type === 'item' && item) {
        const existingItems = prev.inventory || [];
        if (!existingItems.includes(item)) {
          update.inventory = [...existingItems, item];
        }
      } else if (value !== undefined) {
        const startValue = startValues[type as keyof typeof startValues] || 0;
        update[type as keyof typeof update] = startValue + value;
      }

      return update;
    });
  };

  const createHero = () => {
    if (!newHero.name) {
      Alert.alert('Fehler', 'Bitte Name eingeben!');
      return;
    }

    const hero: Hero = {
      id: Date.now().toString(),
      name: newHero.name,
      class: newHero.class || 'Barbar',
      level: calculateLevel({
        ...newHero,
        class: newHero.class || 'Barbar',
        inventory: [],
        exp: newHero.exp || 0,
      }),
      attack: newHero.attack ?? 0,
      defense: newHero.defense ?? 0,
      strength: newHero.strength ?? 0,
      intelligence: newHero.intelligence ?? 0,
      mana: newHero.mana ?? 0,
      exp: newHero.exp ?? 0,
      gold: newHero.gold ?? 0,
      glory: newHero.glory ?? 0,
      inventory: [],
    };

    const updatedHeroes = [...heroes, hero];
    setHeroes(updatedHeroes);
    saveHeroes(updatedHeroes);
    setModalVisible(false);
    setNewHero({});
  };

  const validateHero = (hero: Partial<Hero>): hero is Hero => {
    return !!hero.name && hero.class !== undefined;
  };

  const saveEditedHero = () => {
    const id = newHero.id || selectedHero?.id;
    if (!id) return;

    const updatedHero: Hero = {
      ...selectedHero,
      ...newHero,
      id,
      class: newHero.class || selectedHero?.class || 'Barbar',
      level: calculateLevel(
        {
          ...selectedHero,
          ...newHero,
          class: newHero.class || selectedHero.class || 'Barbar',
          exp: newHero.exp ?? selectedHero.exp,
        },
        classAbilities,
      ),
      attack: newHero.attack ?? selectedHero?.attack ?? 0,
      defense: newHero.defense ?? selectedHero?.defense ?? 0,
      strength: newHero.strength ?? selectedHero?.strength ?? 0,
      intelligence: newHero.intelligence ?? selectedHero?.intelligence ?? 0,
      mana: newHero.mana ?? selectedHero?.mana ?? 0,
      exp: newHero.exp ?? selectedHero?.exp ?? 0,
      gold: newHero.gold ?? selectedHero?.gold ?? 0,
      glory: newHero.glory ?? selectedHero?.glory ?? 0,
    };

    const updatedHeroes = heroes.map((hero) => (hero.id === updatedHero.id ? updatedHero : hero));

    setHeroes(updatedHeroes);
    saveHeroes(updatedHeroes);
    setSelectedHero(updatedHero);
    setModalVisible(false);
    setNewHero({});
  };

  const saveInventory = () => {
    if (!selectedHero) return;
    const updatedInventory = processInventory(editableInventory);
    const updatedHero = { ...selectedHero, inventory: updatedInventory };
    const updatedHeroes = heroes.map((hero) => (hero.id === selectedHero.id ? updatedHero : hero));
    setHeroes(updatedHeroes);
    setSelectedHero(updatedHero);
    saveHeroes(updatedHeroes);
    setInventoryModalVisible(false);
  };

  const openInventoryModal = (hero: Hero) => {
    setSelectedHero(hero);
    setEditableInventory(inventoryToString(hero.inventory));
    setInventoryModalVisible(true);
  };

  const handleDeleteHero = (heroId: string) => {
    const deleteConfirmed = () => {
      const updated = heroes.filter((h) => h.id !== heroId);
      setHeroes(updated);
      saveHeroes(updated);
      if (selectedHero?.id === heroId) setSelectedHero(null);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Möchtest du diesen Helden wirklich löschen?');
      if (confirmed) deleteConfirmed();
    } else {
      Alert.alert('Helden löschen', 'Möchtest du diesen Helden wirklich löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: deleteConfirmed,
        },
      ]);
    }
  };

  const handleBack = () => {
    setWelcomeScreen(true);
    setSelectedHero(null);
    setRewardAnimations([]);
    setAnimatingValues({});
    setDefeatedMonsters([]);
    setShowDiceAnimation(false);
    setDiceRolls(null);
    setSelectedMonster(null);
    setHeroSearchTerm('');
    setMonsterSearchTerm('');
    setModalVisible(false);
    setInventoryModalVisible(false);
    setSettingsModalVisible(false);
    setZoomedImage(null);
    saveHeroes(heroes);
  };

  const filteredHeroes = heroes.filter((hero) =>
    hero.name.toLowerCase().includes(heroSearchTerm.toLowerCase()),
  );
  const filteredMonsters =
    monsters?.filter((monster) =>
      monster?.name?.toLowerCase().includes(monsterSearchTerm.toLowerCase()),
    ) || [];

  const adjustValue = (key: keyof Omit<Hero, 'id' | 'inventory'>, change: number) => {
    setNewHero((prev) => {
      const currentValue = (prev[key] || 0) as number;
      const newValue = Math.max(0, currentValue + change);

      return {
        ...prev,
        [key]: newValue,
        ...(key === 'exp'
          ? {
              level: calculateLevel({
                ...prev,
                [key]: newValue,
                class: prev.class || selectedHero?.class || 'Barbar',
                inventory: [],
              } as Hero),
            }
          : {}),
      };
    });
  };

  const updateHeroLevels = () => {
    setHeroes((prevHeroes) =>
      prevHeroes.map((hero) => ({
        ...hero,
        level: calculateLevel(hero),
      })),
    );
  };

  const updateHeroHighlight = (heroId?: string, type?: string) => {
    if (!heroId || !type) return;

    setHeroes((prev) =>
      prev.map((h) =>
        h.id === heroId
          ? {
              ...h,
              highlightFields: {
                ...h.highlightFields,
                [type]: true,
              },
            }
          : h,
      ),
    );
  };

  const attributeMap: { label: string; key: keyof Hero }[] = [
    { label: 'Angriff', key: 'attack' },
    { label: 'Verteidigung', key: 'defense' },
    { label: 'Körperkraft', key: 'strength' },
    { label: 'Intelligenz', key: 'intelligence' },
    { label: 'Mana', key: 'mana' },
    { label: 'EXP', key: 'exp' },
    { label: 'Gold', key: 'gold' },
    { label: 'Ruhmesplättchen', key: 'glory' },
  ];

  const diceAnimationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {welcomeScreen ? (
          <View style={styles.welcomeScreen}>
            <Image
              source={willkommensBild}
              style={[styles.backgroundImage, responsiveStyles.welcomeImage]}
            />
            <Image source={heroquestLogo} style={styles.logo} />
            <View style={{ marginTop: 20 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.neutralButton,
                  pressed && { backgroundColor: 'rgba(255,255,255,0.1)' },
                ]}
                onPress={loadGameData}
              >
                <Text style={styles.heroQuestButtonText}>🔹 Spiel starten</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.neutralButton,
                  pressed && { backgroundColor: 'rgba(255,255,255,0.1)' },
                ]}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.heroQuestButtonText}>🦸 Neuen Helden erstellen</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.neutralButton,
                  pressed && { backgroundColor: 'rgba(255,255,255,0.1)' },
                ]}
                onPress={() => {
                  setOriginalSettings(settings);
                  setSettingsModalVisible(true);
                }}
              >
                <Text style={styles.heroQuestButtonText}>⚙️ Einstellungen</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} disabled={isAnimating}>
              <Text style={styles.buttonText}>Zurück</Text>
            </TouchableOpacity>

            {showDiceAnimation && selectedMonster && (
              <View style={styles.animationOverlay}>
                {renderDiceFaces(selectedMonster)}
                {diceRolls && (
                  <View style={styles.diceResults}>
                    {selectedMonster.w6 > 0 && (
                      <Text style={styles.diceResultText}>W6: {diceRolls.w6.join(', ')}</Text>
                    )}
                    {selectedMonster.w20 > 0 && (
                      <Text style={styles.diceResultText}>W20: {diceRolls.w20.join(', ')}</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {isAnimating && !settings.animationsDisabled && (
              <View
                style={[
                  styles.interactionBlocker,
                  {
                    backgroundColor: 'transparent',
                    zIndex: 999,
                  },
                ]}
                pointerEvents={isAnimating ? 'auto' : 'none'}
              />
            )}

            {!settings.animationsDisabled &&
              rewardAnimations
                .filter((anim) => anim.hero?.id === selectedHero?.id)
                .map((anim, index) => (
                  <View
                    key={`${anim.type}-${anim.hero?.id}-${index}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 999,
                      pointerEvents: 'none',
                    }}
                  >
                    <RewardAnimation
                      anim={anim}
                      onComplete={(completedAnim) => {
                        addRewardToHero(completedAnim);
                        setRewardAnimations((prev) =>
                          prev.filter(
                            (a) =>
                              !(
                                a.type === completedAnim.type &&
                                a.hero?.id === completedAnim.hero?.id &&
                                (a.type !== 'item' || a.item === completedAnim.item)
                              ),
                          ),
                        );
                        if (rewardAnimations.length <= 1) {
                          setIsAnimating(false);
                          setSelectedMonster(null);
                          setAnimatingValues({});
                        }
                      }}
                      onValueUpdate={handleValueUpdate}
                      selectedHero={selectedHero}
                      styles={styles}
                    />
                  </View>
                ))}

            <ScrollView
              horizontal={true}
              style={[styles.mainContentContainer, responsiveStyles.mainContentContainer]}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 10,
                justifyContent: 'space-around',
              }}
            >
              <View style={[styles.column, responsiveStyles.column]}>
                <Text style={styles.columnTitle}>🦸 Helden</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="🔍 Helden suchen..."
                  placeholderTextColor="#aaa"
                  value={heroSearchTerm}
                  onChangeText={setHeroSearchTerm}
                />
                <View style={{ flex: 1, paddingHorizontal: 8, width: '100%' }}>
                  <FlatList
                    data={filteredHeroes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { width: '100%' }]}
                    renderItem={({ item }) => (
                      <HeroItem
                        item={item}
                        selectedHero={selectedHero}
                        onSelect={setSelectedHero}
                        onEdit={() => {
                          if (!isAnimating) {
                            setNewHero({
                              ...item,
                              attack: item.attack || 0,
                              defense: item.defense || 0,
                              strength: item.strength || 0,
                              intelligence: item.intelligence || 0,
                              mana: item.mana || 0,
                              exp: item.exp || 0,
                              gold: item.gold || 0,
                              glory: item.glory || 0,
                            });
                            setModalVisible(true);
                          }
                        }}
                        onInventory={() => !isAnimating && openInventoryModal(item)}
                        onDelete={() => !isAnimating && handleDeleteHero(item.id)}
                        highlightFields={item.highlightFields || {}}
                        animatingValues={animatingValues}
                        ref={item.id === selectedHero?.id ? heroRef : null}
                        isAnimating={isAnimating}
                        styles={styles}
                        responsiveStyles={responsiveStyles}
                        classAbilities={classAbilities}
                      />
                    )}
                  />
                </View>
              </View>

              <View style={[styles.column, responsiveStyles.column]}>
                <Text style={styles.columnTitle}>👹 Monster</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="🔍 Monster suchen..."
                  placeholderTextColor="#aaa"
                  value={monsterSearchTerm}
                  onChangeText={setMonsterSearchTerm}
                />
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <FlatList
                    data={filteredMonsters}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                      <Text style={styles.heroInventoryText}>
                        {monsters.length === 0
                          ? 'Monster werden geladen...'
                          : 'Keine Monster gefunden'}
                      </Text>
                    }
                    renderItem={({ item }) => (
                      <MonsterButton
                        item={item}
                        selectedHero={selectedHero}
                        onDefeat={handleDefeatMonster}
                        isAnimating={isAnimating}
                        styles={styles}
                      />
                    )}
                  />
                </View>
              </View>

              <View style={[styles.column, responsiveStyles.column]}>
                <Text style={styles.columnTitle}>🏆 Belohnungen</Text>
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <FlatList
                    data={defeatedMonsters}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => <RewardItem item={item} styles={styles} />}
                  />
                </View>
              </View>
            </ScrollView>
          </>
        )}

        <Modal isVisible={settingsModalVisible}>
          <View style={styles.modalContainer}>
            <Text style={styles.columnTitle}>⚙️ Einstellungen</Text>
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.settingText}>Monster-/Loot-Datei:</Text>
              <Text style={{ color: 'lightgray', fontSize: 12 }}>
                {settings.monsterLootFileName !== originalSettings.monsterLootFileName
                  ? settings.monsterLootFileName
                  : monsterLootFileName}
              </Text>
              <View style={styles.buttonRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable style={styles.neutralButton} onPress={handleLoadMonsterLootFile}>
                    <Text style={styles.neutralButtonText}>📂 Laden</Text>
                  </Pressable>
                  <TouchableOpacity onPress={() => setShowTooltipMonster(true)}>
                    <Text style={{ fontSize: 20, marginLeft: 6, color: 'white' }}>ℹ️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      downloadAndShareTemplate(
                        'https://raw.githubusercontent.com/lordraidenn/HeroQuestLoot/main/assets/Loot_Vorlage.xlsx',
                        'Loot_Vorlage.xlsx',
                      )
                    }
                  >
                    <Text style={{ fontSize: 20, marginLeft: 10, color: 'lightblue' }}>⬇️</Text>
                  </TouchableOpacity>
                </View>

                <Pressable style={styles.neutralButton} onPress={resetMonsterLootFile}>
                  <Text style={styles.neutralButtonText}>🔄 Zurücksetzen</Text>
                </Pressable>
              </View>

              <ImageZoomModal
                visible={!!zoomedImage}
                imageSource={zoomedImage}
                onClose={() => setZoomedImage(null)}
                styles={styles} // Pass the styles here
              />

              {/* Tooltip-Beispiel */}
              <Tooltip
                isVisible={showTooltipMonster}
                content={
                  <View style={globalStyles.tooltipContainer}>
                    <Text style={globalStyles.tooltipText}>
                      Beispiel für Monster-/Belohnungsliste. Aufbau Zeile 1: Monster | W6 | W20 |
                      Garantierte Belohnung | 1 | 2 | usw. Darunter die entsprechenden Namen und
                      Werte.
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setZoomedImage(require('../../assets/Loot.png'));
                        setShowTooltipMonster(false);
                      }}
                    >
                      <Image
                        source={require('../../assets/Loot.png')}
                        style={globalStyles.tooltipImage}
                      />
                    </TouchableOpacity>
                  </View>
                }
                placement="top"
                onClose={() => setShowTooltipMonster(false)}
              >
                <View>
                  <Text> </Text>
                </View>
              </Tooltip>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={styles.settingText}>Klassen/Fähigkeiten-Datei:</Text>
              <Text style={{ color: 'lightgray', fontSize: 12 }}>
                {settings.classFileName !== originalSettings.classFileName
                  ? settings.classFileName
                  : classFileName}
              </Text>
              <View style={styles.buttonRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable style={styles.neutralButton} onPress={handleLoadClassFile}>
                    <Text style={styles.neutralButtonText}>📂 Laden</Text>
                  </Pressable>
                  <TouchableOpacity onPress={() => setShowTooltipClass(true)}>
                    <Text style={{ fontSize: 20, marginLeft: 6, color: 'white' }}>ℹ️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      downloadAndShareTemplate(
                        'https://raw.githubusercontent.com/lordraidenn/HeroQuestLoot/main/assets/Level_Vorlage.xlsx',
                        'Level_Vorlage.xlsx',
                      )
                    }
                  >
                    <Text style={{ fontSize: 20, marginLeft: 10, color: 'lightblue' }}>⬇️</Text>
                  </TouchableOpacity>
                </View>

                <Pressable style={styles.neutralButton} onPress={resetClassFile}>
                  <Text style={styles.neutralButtonText}>🔄 Zurücksetzen</Text>
                </Pressable>
              </View>

              <Tooltip
                isVisible={showTooltipClass}
                content={
                  <View style={globalStyles.tooltipContainer}>
                    <Text style={globalStyles.tooltipText}>
                      Beispiel für eine Klassen-/Fähigkeitenliste. Wichtig: Erste Zeile = Level &
                      EXP. Darunter die Fähigkeiten. Spalte A listet die Klassen auf (Ausnahme Zeile
                      1).
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setZoomedImage(require('../../assets/Level-Fähigkeiten.png'));
                        setShowTooltipClass(false);
                      }}
                    >
                      <Image
                        source={require('../../assets/Level-Fähigkeiten.png')}
                        style={globalStyles.tooltipImage}
                      />
                    </TouchableOpacity>
                  </View>
                }
                placement="top"
                onClose={() => setShowTooltipClass(false)}
              >
                <View>
                  <Text> </Text>
                </View>
              </Tooltip>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Animationen:</Text>
              <Switch
                value={!settings.animationsDisabled}
                onValueChange={(val) =>
                  setSettings({
                    ...settings,
                    animationsDisabled: !val,
                  })
                }
              />
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.confirmButton}
                onPress={async () => {
                  try {
                    if (settings.monsterLootFileName) {
                      await AsyncStorage.setItem(
                        'monsterLootFileName',
                        settings.monsterLootFileName,
                      );
                    }
                    if (settings.classFileName) {
                      await AsyncStorage.setItem('classAbilitiesFileName', settings.classFileName);
                    }
                    if (settings.monsterFileUri) {
                      await AsyncStorage.setItem('monsterLootFile', settings.monsterFileUri);
                    }
                    if (settings.classFileUri) {
                      await AsyncStorage.setItem('classAbilitiesFile', settings.classFileUri);
                    }

                    await AsyncStorage.setItem('settings', JSON.stringify(settings));

                    setOriginalSettings(settings);
                    if (settings.monsters) setMonsters(settings.monsters);
                    if (settings.classAbilities) setClassAbilities(settings.classAbilities);
                    if (settings.monsterLootFileName)
                      setMonsterLootFileName(settings.monsterLootFileName);
                    if (settings.classFileName) setClassFileName(settings.classFileName);

                    updateHeroLevels();
                    setSettingsModalVisible(false);
                  } catch (error) {
                    console.error('Fehler beim Speichern der Einstellungen:', error);
                    Alert.alert('Fehler', 'Einstellungen konnten nicht gespeichert werden.');
                  }
                }}
              >
                <Text style={styles.modalButtonText}>✅ Speichern</Text>
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setSettings(originalSettings);
                  setSettingsModalVisible(false);
                }}
              >
                <Text style={styles.modalButtonText}>❌ Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal isVisible={modalVisible} onModalHide={() => setNewHero({})}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.columnTitle}>
                {newHero.id ? '✏️ Held bearbeiten' : '🦸 Neuer Held'}
              </Text>

              <View style={{ marginBottom: 10 }}>
                <Text style={styles.buttonText}>NAME:</Text>
                <TextInput
                  style={styles.input}
                  value={newHero.name || ''}
                  onChangeText={(text) => setNewHero((prev) => ({ ...prev, name: text }))}
                />
              </View>

              {!newHero.id && (
                <>
                  <Text style={styles.buttonText}>KLASSE:</Text>
                  <View style={styles.classSelection}>
                    {Object.keys(CLASS_ABILITIES).map((cls) => (
                      <TouchableOpacity
                        key={cls}
                        onPress={() => setNewHero({ ...newHero, class: cls as HeroClass })}
                        style={[styles.classOption, newHero.class === cls && styles.selectedClass]}
                      >
                        <Image source={getClassIcon(cls as HeroClass)} style={styles.classIcon} />
                        <Text style={styles.classText}>{cls}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {attributeMap.map(({ label, key }) => (
                <View key={label} style={{ marginBottom: 12 }}>
                  <Text style={styles.buttonText}>{label.toUpperCase()}:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.adjusterButton}
                      onPress={() => {
                        const value = parseInt(minusInputs[key] || '1');
                        adjustValue(key, -value);
                      }}
                    >
                      <Text style={styles.adjusterButtonText}>−</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={[
                        styles.input,
                        { width: 40, marginHorizontal: 4, textAlign: 'center' },
                      ]}
                      keyboardType="numeric"
                      value={minusInputs[key] || '1'}
                      onChangeText={(text) => setMinusInputs((prev) => ({ ...prev, [key]: text }))}
                    />

                    <TextInput
                      style={[styles.input, { flex: 1, textAlign: 'center' }]}
                      keyboardType="numeric"
                      value={newHero[key]?.toString() ?? ''}
                      onChangeText={(text) => {
                        const numValue = text === '' ? 0 : Number(text);
                        setNewHero((prev) => ({
                          ...prev,
                          [key]: numValue,
                          ...(key === 'exp'
                            ? {
                                level: calculateLevel(
                                  {
                                    ...prev,
                                    [key]: numValue,
                                    class: prev.class || selectedHero?.class || 'Barbar',
                                    inventory: [],
                                  },
                                  classAbilities,
                                ),
                              }
                            : {}),
                        }));
                      }}
                    />

                    <TextInput
                      style={[
                        styles.input,
                        { width: 40, marginHorizontal: 4, textAlign: 'center' },
                      ]}
                      keyboardType="numeric"
                      value={plusInputs[key] || '1'}
                      onChangeText={(text) => setPlusInputs((prev) => ({ ...prev, [key]: text }))}
                    />

                    <TouchableOpacity
                      style={styles.adjusterButton}
                      onPress={() => {
                        const value = parseInt(plusInputs[key] || '1');
                        adjustValue(key, value);
                      }}
                    >
                      <Text style={styles.adjusterButtonText}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.buttonRow}>
              <Pressable
                style={styles.confirmButton}
                onPress={newHero.id ? saveEditedHero : createHero}
              >
                <Text style={styles.modalButtonText}>✅ Speichern</Text>
              </Pressable>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setNewHero({});
                }}
              >
                <Text style={styles.modalButtonText}>❌ Abbrechen</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal isVisible={inventoryModalVisible} animationIn="fadeInUp" animationOut="fadeOutDown">
          <View style={styles.modalContainer}>
            <Image
              source={inventarBild}
              style={[styles.backgroundImage, responsiveStyles.inventarImage]}
            />
            <View style={styles.modalContent}>
              <Text style={styles.columnTitle}>📦 Inventar bearbeiten</Text>
              <TextInput
                style={styles.inventoryInput}
                multiline
                value={editableInventory}
                onChangeText={setEditableInventory}
              />
              <View style={styles.buttonRow}>
                <Pressable style={styles.confirmButton} onPress={saveInventory}>
                  <Text style={styles.modalButtonText}>✅ Speichern</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setInventoryModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>❌ Abbrechen</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}
