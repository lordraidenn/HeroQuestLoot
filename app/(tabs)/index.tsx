import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Modal, TextInput, Image, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import monstersData from '../../assets/Loot.json';

// Plattformabhängige Importe
let DocumentPicker: any = null;
let FileSystem: any = null;

if (Platform.OS !== 'web') {
    DocumentPicker = require('expo-document-picker');
    FileSystem = require('expo-file-system');
}

// Bildschirmgröße ermitteln
const { width, height } = Dimensions.get('window');

// Hero-Typ definieren
type Hero = {
    id: string;
    name: string;
    attack: number;
    defense: number;
    strength: number;
    intelligence: number;
    mana: number;
    exp: number;
    gold: number;
    glory: number;
    inventory: string[];
};

// Monster-Typ definieren
type Monster = {
    id: string;
    name: string;
    w6: number;
    w20: number;
    guaranteed: string;
    rewards: Record<number, string>;
};

// Loot-Typ definieren
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

// Funktion zum Würfeln
const rollDice = (sides: number, amount: number) => {
    return Array.from({ length: amount }, () => Math.floor(Math.random() * sides) + 1);
};

// Styles außerhalb der Komponente definieren
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#222',
    },
    welcomeScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    logo: {
        width: 370,
        height: 140,
        resizeMode: 'contain',
        marginBottom: 315,
    },
    valueInput: {
        backgroundColor: '#555',
        color: 'white',
        padding: 5,
        borderRadius: 5,
        width: 50,
        textAlign: 'center',
        marginHorizontal: 5,
    },
    inventoryModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        position: 'relative',
    },
    backgroundImage: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
        opacity: 1,
    },
    inventoryModalContent: {
        backgroundColor: 'rgba(51, 51, 51, 0.7)',
        padding: 20,
        borderRadius: 10,
        width: '80%',
        zIndex: 2,
    },
    mainContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 10,
    },
    column: {
        flex: 1,
        marginHorizontal: 10,
    },
    columnTitle: {
        fontSize: 12,
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        marginTop: 60,
    },
    listItemContainer: {
        backgroundColor: '#444',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
    },
    selectedHeroContainer: {
        backgroundColor: '#666',
    },
    listItem: {
        fontSize: 16,
        color: 'orange',
    },
    heroStatsText: {
        color: 'lightgreen',
        fontSize: 9,
    },
    heroInventoryText: {
        color: 'lightblue',
        fontSize: 10,
    },
    heroPointsText: {
        color: 'yellow',
        fontSize: 10,
    },
    editButton: {
        backgroundColor: '#888',
        padding: 5,
        marginTop: 10,
        borderRadius: 5,
    },
    deleteButton: {
        backgroundColor: '#f00',
        padding: 5,
        marginTop: 10,
        borderRadius: 5,
    },
    monsterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    monsterButton: {
        backgroundColor: '#555',
        padding: 10,
        borderRadius: 5,
        marginBottom: 5,
    },
    disabledButton: {
        opacity: 0.5,
    },
    monsterButtonText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: 'pink',
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    rewardText: {
        color: 'white',
        fontSize: 10,
    },
    diceText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffcc00',
        marginBottom: 1,
    },
    diceSumText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffa500',
        marginBottom: 1,
    },
    backButton: {
        backgroundColor: '#008CBA',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
        position: 'absolute',
        top: 20,
        right: 15,
    },
    backButtonText: {
        color: 'white',
        fontSize: 18,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#333',
        padding: 20,
        borderRadius: 10,
        width: 300,
    },
    modalTitle: {
        fontSize: 20,
        color: 'white',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#555',
        color: 'white',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
        fontSize: 16,
    },
    label: {
        color: 'white',
        fontSize: 16,
        marginBottom: 5,
    },
    valueAdjusterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    adjusterButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    adjusterButton: {
        backgroundColor: '#666',
        padding: 5,
        borderRadius: 5,
        marginHorizontal: 5,
    },
    adjusterButtonText: {
        color: 'white',
        fontSize: 16,
    },
    valueText: {
        color: 'white',
        fontSize: 16,
        marginHorizontal: 10,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    button: {
        flex: 1,
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    saveButton: {
        backgroundColor: '#008CBA',
    },
    cancelButton: {
        backgroundColor: '#f00',
    },
    buttonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    inventoryButton: {
        backgroundColor: '#666',
        padding: 5,
        marginTop: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    inventoryInput: {
        backgroundColor: '#555',
        color: 'white',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
        fontSize: 16,
        minHeight: 100,
    },
    inventoryButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});

export default function App() {
    const [welcomeScreen, setWelcomeScreen] = useState(true);
    const [heroes, setHeroes] = useState<Hero[]>([]);
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
    const [defeatedMonsters, setDefeatedMonsters] = useState<Loot[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newHero, setNewHero] = useState<Partial<Hero>>({ name: '', attack: 0, defense: 0, strength: 0, intelligence: 0, mana: 0, exp: 0, gold: 0, glory: 0, inventory: [] });

    // State für das Inventar-Modal
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
    const [editableInventory, setEditableInventory] = useState<string>('');

    const loadXlsxFromAssets = async () => {
        try {
            const response = await fetch('/assets/Loot.xlsx');
            const arrayBuffer = await response.arrayBuffer();

            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const monsters: Monster[] = [];
            let row = 2;

            while (true) {
                const nameCell = sheet[`A${row}`];
                if (!nameCell) break;

                const monster: Monster = {
                    id: `${nameCell.v}-${row}`,
                    name: nameCell.v,
                    w6: sheet[`B${row}`]?.v || 0,
                    w20: sheet[`C${row}`]?.v || 0,
                    guaranteed: sheet[`D${row}`]?.v || 'Keine garantierte Belohnung',
                    rewards: {},
                };

                for (let i = 1; i <= 20; i++) {
                    const columnLetter = String.fromCharCode(69 + i - 1);
                    const rewardCell = sheet[`${columnLetter}${row}`];
                    if (rewardCell) monster.rewards[i] = rewardCell.v;
                }

                monsters.push(monster);
                row++;
            }

            setMonsters(monsters);
            setWelcomeScreen(false);
            console.log('🗂️ Loot.xlsx erfolgreich geladen (Web)');
        } catch (error) {
            console.error('❌ Fehler beim Laden von Loot.xlsx:', error);
        }
    };

    // Lade die Loot.json-Datei beim Start der App
    const loadLootData = async () => {
        try {
            const lootData = require('../../assets/Loot.json');
            const formattedData = lootData.Tabelle1.map((item, index) => {
                const rewards: Record<number, string> = {};
                for (let i = 1; i <= 20; i++) {
                    if (item[i.toString()]) {
                        rewards[i] = item[i.toString()];
                    }
                }

                const monster: Monster = {
                    id: `${item.Monster}-${index}`,
                    name: item.Monster,
                    w6: parseInt(item.W6) || 0,
                    w20: parseInt(item.W20) || 0,
                    guaranteed: item["Garantierte Belohnung"] || "Keine garantierte Belohnung",
                    rewards,
                };

                return monster;
            });

            setMonsters(formattedData);
            setWelcomeScreen(false);
            console.log('📄 Loot.json erfolgreich geladen und korrekt formatiert:', formattedData);
        } catch (error) {
            console.error('❌ Fehler beim Laden der Loot.json:', error);
        }
    };

    // Funktion zum Öffnen des Inventar-Modals
    const openInventoryModal = (hero: Hero) => {
        setSelectedHero(hero);
        setEditableInventory(hero.inventory.join(', ')); // Inventar als Text anzeigen
        setInventoryModalVisible(true);
    };

    // Funktion zum Speichern des bearbeiteten Inventars
    const saveInventory = () => {
        if (!selectedHero) return;

        const updatedInventory = editableInventory
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0) // Leere Einträge entfernen
            .sort((a, b) => a.localeCompare(b)); // Alphabetisch sortieren

        const updatedHero = { ...selectedHero, inventory: updatedInventory };

        // Helden in der Liste aktualisieren
        const updatedHeroes = heroes.map(hero => hero.id === selectedHero.id ? updatedHero : hero);
        setHeroes(updatedHeroes);
        saveHeroes(updatedHeroes); // Helden speichern

        setInventoryModalVisible(false); // Modal schließen
    };

    // Funktion zum Schließen des Inventar-Modals
    const closeInventoryModal = () => {
        setInventoryModalVisible(false);
    };

    // Helden beim Start laden
    useEffect(() => {
        (async () => {
            const loadedHeroes = await loadHeroes();
            if (JSON.stringify(heroes) !== JSON.stringify(loadedHeroes)) {
                console.log("📥 Helden aus Speicher geladen:", loadedHeroes);
                setHeroes(loadedHeroes);
            }
        })();
    }, []);

    // Helden speichern
    const saveHeroes = async (heroes: Hero[]) => {
        try {
            await AsyncStorage.setItem('heroes', JSON.stringify(heroes));
            console.log("💾 Helden gespeichert:", heroes);
        } catch (error) {
            console.error("❌ Fehler beim Speichern:", error);
        }
    };

    // Helden laden
    const loadHeroes = async () => {
        try {
            const savedHeroes = await AsyncStorage.getItem('heroes');
            return savedHeroes ? JSON.parse(savedHeroes) : [];
        } catch (error) {
            console.error("❌ Fehler beim Laden:", error);
            return [];
        }
    };

    // Neuen Helden erstellen
    const createHero = () => {
        if (!newHero.name) {
            Alert.alert("Fehler", "Bitte gib einen Namen für den Helden ein!");
            return;
        }

        const newHeroData: Hero = {
            id: Date.now().toString(),
            exp: newHero.exp || 0,
            gold: newHero.gold || 0,
            glory: newHero.glory || 0,
            inventory: [],
            ...newHero
        };

        setHeroes(prevHeroes => {
            // Sicherstellen, dass prevHeroes immer ein Array ist
            const currentHeroes = Array.isArray(prevHeroes) ? prevHeroes : [];

            if (currentHeroes.some(hero => hero.id === newHeroData.id)) {
                console.log("⚠️ Held existiert bereits!");
                return currentHeroes;
            }
            console.log("✅ Neuer Held hinzugefügt:", newHeroData);
            const updatedHeroes = [...currentHeroes, newHeroData];
            saveHeroes(updatedHeroes);
            return updatedHeroes;
        });

        setModalVisible(false);
        setNewHero({ name: '', attack: 0, defense: 0, strength: 0, intelligence: 0, mana: 0, exp: 0, gold: 0, glory: 0, inventory: [] });
    };

    // Helden bearbeiten
    const handleEditHero = (hero: Hero) => {
        setNewHero(hero); // Hero-Daten ins Formular übernehmen
        setModalVisible(true); // Modal öffnen
    };

    // Speichern der bearbeiteten Heldendaten
    const saveEditedHero = () => {
        if (!newHero.id) {
            console.error("❌ Fehler: Held hat keine ID!");
            return;
        }

        const updatedHeroes = heroes.map(hero =>
            hero.id === newHero.id
                ? {
                    ...hero, ...newHero,
                    attack: parseInt(newHero.attack?.toString()) || 0,
                    defense: parseInt(newHero.defense?.toString()) || 0,
                    strength: parseInt(newHero.strength?.toString()) || 0,
                    intelligence: parseInt(newHero.intelligence?.toString()) || 0,
                    mana: parseInt(newHero.mana?.toString()) || 0,
                    exp: parseInt(newHero.exp?.toString()) || 0,
                    gold: parseInt(newHero.gold?.toString()) || 0,
                    glory: parseInt(newHero.glory?.toString()) || 0
                }
                : hero
        );

        setHeroes(updatedHeroes);
        saveHeroes(updatedHeroes); // Helden speichern
        setModalVisible(false);
        setNewHero({ name: '', attack: 0, defense: 0, strength: 0, intelligence: 0, mana: 0, exp: 0, gold: 0, glory: 0, inventory: [] }); // Formular zurücksetzen
    };

    // Monster besiegen & Belohnung verteilen
    const handleDefeat = (monster: Monster) => {
        if (!selectedHero) return;

        const w6Rolls = rollDice(6, monster.w6);
        const w20Rolls = rollDice(20, monster.w20);
        const w6Sum = w6Rolls.reduce((sum, roll) => sum + roll, 0);
        const w20Sum = w20Rolls.reduce((sum, roll) => sum + roll, 0);

        // Loot für den besiegten Monster
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

        // Aktualisiere den Helden direkt in setHeroes
        setHeroes(prevHeroes => {
            const updatedHeroes = prevHeroes.map(hero => {
                if (hero.id !== selectedHero.id) return hero;

                let updatedExp = hero.exp;
                let updatedGold = hero.gold;
                let updatedGlory = hero.glory;
                let updatedInventory = [...hero.inventory];

                // Funktion zum Extrahieren von EXP, Gold und Ruhmesplättchen aus einem Text
                const extractValues = (reward: string) => {
                    const expRegex = /(\d+)\s*EXP/;
                    const goldRegex = /(\d+)\s*Gold/;
                    const gloryRegex = /(\d+)\s*Ruhmesplättchen/;
                    const expMatch = reward.match(expRegex);
                    const goldMatch = reward.match(goldRegex);
                    const gloryMatch = reward.match(gloryRegex);

                    return {
                        exp: expMatch ? parseInt(expMatch[1]) : 0,
                        gold: goldMatch ? parseInt(goldMatch[1]) : 0,
                        glory: gloryMatch ? parseInt(gloryMatch[1]) : 0,
                    };
                };

                // W6- und W20-Belohnungen + garantierte Belohnung verarbeiten
                [loot.w6Reward, loot.w20Reward, monster.guaranteed].forEach(reward => {
                    if (!reward || reward.includes('Keine Belohnung')) return;

                    if (reward.includes('EXP') || reward.includes('Gold') || reward.includes('Ruhmesplättchen')) {
                        const { exp, gold, glory } = extractValues(reward);
                        updatedExp += exp;
                        updatedGold += gold;
                        updatedGlory += glory;
                    } else if (reward === 'Gold') {
                        updatedGold += 10;
                    } else if (reward === 'Ruhmesplättchen') {
                        updatedGlory += 1;
                    } else {
                        updatedInventory.push(reward);
                    }
                });

                // Neuen Zustand des Helden setzen
                return {
                    ...hero,
                    exp: updatedExp,
                    gold: updatedGold,
                    glory: updatedGlory,
                    inventory: updatedInventory.sort((a, b) => a.localeCompare(b)), // Inventar alphabetisch sortieren
                };
            });

            saveHeroes(updatedHeroes); // Helden sofort speichern
            return updatedHeroes;
        });

        setDefeatedMonsters(prevMonsters => [loot, ...prevMonsters]); // Neueste Belohnung immer oben
    };

    // Zurück zum Willkommensbildschirm
    const handleBackToWelcome = async () => {
        setWelcomeScreen(true);
        const loadedHeroes = await loadHeroes();
        setHeroes(loadedHeroes);
    };

    // Helden löschen
    const handleDeleteHero = (heroId: string) => {
        Alert.alert('Helden löschen', 'Möchten Sie diesen Helden wirklich löschen?', [
            { text: 'Abbrechen' },
            {
                text: 'Löschen',
                onPress: async () => {
                    const updatedHeroes = heroes.filter(hero => hero.id !== heroId);
                    setHeroes(updatedHeroes);
                    await saveHeroes(updatedHeroes); // Nach dem Löschen speichern
                    if (selectedHero?.id === heroId) {
                        setSelectedHero(null); // Auswahl zurücksetzen
                    }
                },
            },
        ]);
    };

    // Excel-Datei auswählen und Monster importieren
    const pickDocument = async () => {
        if (Platform.OS === 'web') {
            await loadXlsxFromAssets();
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });

            if (!result.assets || result.assets.length === 0) return;

            const uri = result.assets[0].uri;
            const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

            const workbook = XLSX.read(fileData, { type: 'base64' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const monsters: Monster[] = [];
            let row = 2;

            while (true) {
                const nameCell = sheet[`A${row}`];
                if (!nameCell) break;

                const monster: Monster = {
                    id: `${nameCell.v}-${row}`,
                    name: nameCell.v,
                    w6: sheet[`B${row}`]?.v || 0,
                    w20: sheet[`C${row}`]?.v || 0,
                    guaranteed: sheet[`D${row}`]?.v || 'Keine garantierte Belohnung',
                    rewards: {},
                };

                for (let i = 1; i <= 20; i++) {
                    const columnLetter = getExcelColumnLetter(4 + i);
                    const rewardCell = sheet[`${columnLetter}${row}`];
                    if (rewardCell) {
                        monster.rewards[i] = rewardCell.v;
                    }
                }

                monsters.push(monster);
                row++;
            }

            setMonsters(monsters);
            setWelcomeScreen(false);
            console.log('📂 Loot.xlsx erfolgreich geladen (Mobile)', monsters);
        } catch (error) {
            console.error('❌ Fehler beim Laden der Datei:', error);
        }
    };

    // Funktion zum Erhöhen oder Verringern von Werten
    const adjustValue = (field: keyof Hero, delta: number) => {
        setNewHero(prev => ({
            ...prev,
            [field]: Math.max(0, (prev[field] || 0) + delta), // Verhindert negative Werte
        }));
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                {welcomeScreen ? (
                    <View style={styles.welcomeScreen}>
                        <Image source={require('./Willkommensbild.png')} style={styles.backgroundImage} />
                        <Image source={require('./heroquest_logo.png')} style={styles.logo} />
                        <Button title="Spiel starten" onPress={loadLootData} />
                        <Button title="📂 Eigene Liste laden" onPress={pickDocument} />
                        <Button title="Neuen Heroen erstellen" onPress={() => setModalVisible(true)} />
                    </View>
                ) : (
                    <View style={styles.mainContainer}>
                        {/* Button zurück zum Willkommensbildschirm */}
                        <TouchableOpacity onPress={handleBackToWelcome} style={styles.backButton}>
                            <Text style={styles.backButtonText}>Zurück</Text>
                        </TouchableOpacity>

                        {/* Heroen Spalte */}
                        <View style={styles.column}>
                            <Text style={styles.columnTitle}>🦸‍♂️ Heroen</Text>
                            <FlatList
                                data={heroes}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 180 }} // Platz für Scrollbarkeit
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.listItemContainer,
                                            selectedHero?.id === item.id && styles.selectedHeroContainer, // Markierung des ausgewählten Helden
                                        ]}
                                        onPress={() => {
                                            // Wenn der bereits ausgewählte Held erneut angeklickt wird, wird er abgewählt
                                            if (selectedHero?.id === item.id) {
                                                setSelectedHero(null);
                                            } else {
                                                setSelectedHero(item);
                                            }
                                        }}
                                    >
                                        <Text style={styles.listItem}>{item.name}</Text>
                                        <View style={styles.heroStatsContainer}>
                                            <Text style={styles.heroStatsText}>⚔ Angriff: {item.attack}</Text>
                                            <Text style={styles.heroStatsText}>🛡 Verteidigung: {item.defense}</Text>
                                            <Text style={styles.heroStatsText}>🎓 Intelligenz: {item.intelligence}</Text>
                                            <Text style={styles.heroStatsText}>💪 Körperkraft: {item.strength}</Text>
                                            <Text style={styles.heroStatsText}>🔮 Mana: {item.mana}</Text>
                                        </View>
                                        <Text style={styles.heroPointsText}>⭐ EXP: {item.exp}</Text>
                                        <Text style={styles.heroPointsText}>💰 Gold: {item.gold}</Text>
                                        <Text style={styles.heroPointsText}>🏆 Ruhm: {item.glory}</Text>
                                        <Text style={styles.heroInventoryText}>📦 Inventar: {item.inventory.join(', ') || 'Leer'}</Text>

                                        {/* Button zum Öffnen des Inventar-Modals */}
                                        <TouchableOpacity
                                            style={styles.inventoryButton}
                                            onPress={() => openInventoryModal(item)}
                                        >
                                            <Text style={styles.buttonText}>📜 Inventar bearbeiten</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={() => handleEditHero(item)}
                                        >
                                            <Text style={styles.buttonText}>✏️ Bearbeiten</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteHero(item.id)}
                                        >
                                            <Text style={styles.buttonText}>🗑️ Löschen</Text>
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>

                        {/* Monster Spalte */}
                        <View style={styles.column}>
                            <Text style={styles.columnTitle}>💀 Monster</Text>
                            <FlatList
                                data={monsters}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 180 }} // Platz für Scrollbarkeit
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.monsterButton, !selectedHero && styles.disabledButton]}
                                        onPress={() => {
                                            if (!selectedHero) {
                                                Alert.alert('Fehler', 'Es muss ein Held ausgewählt sein, um Monster zu bekämpfen.');
                                                return;
                                            }
                                            handleDefeat(item);
                                        }}
                                        disabled={!selectedHero}
                                    >
                                        <View style={styles.monsterRow}>
                                            <Text style={styles.monsterButtonText}>{item.name}</Text>
                                            <Text style={styles.monsterIcon}>⚔️</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>

                        {/* Belohnungen Spalte */}
                        <View style={styles.column}>
                            <Text style={styles.columnTitle}>🎁 Belohnungen</Text>
                            <FlatList
                                data={defeatedMonsters}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 180 }} // Scroll-Problem lösen
                                renderItem={({ item }) => (
                                    <View style={styles.listItemContainer}>
                                        <Text style={styles.rewardText}>🎯 Garantierte Belohnung: {item.monster.guaranteed}</Text>
                                        {/* Würfelergebnisse für W6 anzeigen, falls vorhanden */}
                                        {item.w6Rolls.length > 0 && (
                                            <>
                                                <Text style={styles.diceText}>🎲 W6: {item.w6Rolls.join(', ')}</Text>
                                                {item.w6Rolls.length > 1 && (
                                                    <Text style={styles.diceSumText}>➕ Summe: {item.w6Sum}</Text>
                                                )}
                                                <Text style={styles.rewardText}>➡️ W6 Belohnung: {item.w6Reward}</Text>
                                            </>
                                        )}

                                        {/* Würfelergebnisse für W20 anzeigen, falls vorhanden */}
                                        {item.w20Rolls.length > 0 && (
                                            <>
                                                <Text style={styles.diceText}>🎲 W20: {item.w20Rolls.join(', ')}</Text>
                                                {item.w20Rolls.length > 1 && (
                                                    <Text style={styles.diceSumText}>➕ Summe: {item.w20Sum}</Text>
                                                )}
                                                <Text style={styles.rewardText}>➡️ W20 Belohnung: {item.w20Reward}</Text>
                                            </>
                                        )}
                                    </View>
                                )}
                            />
                        </View>
                    </View>
                )}

                {/* Modal zum Erstellen und Bearbeiten eines Helden */}
                <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{newHero.id ? 'Held bearbeiten' : 'Neuen Helden erstellen'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Name des Helden"
                                value={newHero.name}
                                onChangeText={(text) => setNewHero({ ...newHero, name: text })}
                            />

                            {/* Angriff */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Angriff:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('attack', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.attack?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, attack: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('attack', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Verteidigung */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Verteidigung:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('defense', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.defense?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, defense: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('defense', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Stärke */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Körperkraft:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('strength', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.strength?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, strength: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('strength', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Intelligenz */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Intelligenz:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('intelligence', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.intelligence?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, intelligence: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('intelligence', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Mana */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Mana:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('mana', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.mana?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, mana: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('mana', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* EXP */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>EXP:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('exp', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.exp?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, exp: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('exp', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Gold */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Gold:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('gold', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.gold?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, gold: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('gold', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Ruhmesplättchen */}
                            <View style={styles.valueAdjusterContainer}>
                                <Text style={styles.label}>Ruhmesplättchen:</Text>
                                <View style={styles.adjusterButtons}>
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('glory', -1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>-</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.valueInput}
                                        value={newHero.glory?.toString()}
                                        onChangeText={(text) => setNewHero({ ...newHero, glory: parseInt(text) || 0 })}
                                        keyboardType="numeric"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjusterButton}
                                        onPress={() => adjustValue('glory', 1)}
                                    >
                                        <Text style={styles.adjusterButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Buttons zum Speichern oder Abbrechen */}
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    onPress={newHero.id ? saveEditedHero : createHero}
                                    style={[styles.button, styles.saveButton]}
                                >
                                    <Text style={styles.buttonText}>{newHero.id ? 'Speichern' : 'Erstellen'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setModalVisible(false)}
                                    style={[styles.button, styles.cancelButton]}
                                >
                                    <Text style={styles.buttonText}>Abbrechen</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Modal zum Bearbeiten des Inventars */}
                <Modal visible={inventoryModalVisible} animationType="slide" transparent={true}>
                    <View style={styles.inventoryModalContainer}>
                        <Image source={require('./Inventar.png')} style={styles.backgroundImage} />
                        <View style={styles.inventoryModalContent}>
                            <Text style={styles.modalTitle}>Inventar bearbeiten</Text>
                            <TextInput
                                style={styles.inventoryInput}
                                multiline={true}
                                value={editableInventory}
                                onChangeText={(text) => setEditableInventory(text)}
                            />
                            <View style={styles.inventoryButtonContainer}>
                                <TouchableOpacity
                                    style={[styles.inventoryButton, styles.saveButton]}
                                    onPress={saveInventory}
                                >
                                    <Text style={styles.buttonText}>Speichern</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.inventoryButton, styles.closeButton]}
                                    onPress={closeInventoryModal}
                                >
                                    <Text style={styles.buttonText}>Schließen</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </GestureHandlerRootView>
    );
}