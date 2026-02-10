import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SavedConnection } from "./types";

const STORAGE_KEY = "codex.remote.connections.v1";

export async function loadSavedConnections(): Promise<SavedConnection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function persistSavedConnections(connections: SavedConnection[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}