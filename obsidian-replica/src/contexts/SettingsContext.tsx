import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface Settings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    codeFontFamily: string;
  };
  editor: {
    tabSize: number;
    lineNumbers: boolean;
    lineWrapping: boolean;
    spellCheck: boolean;
    autoSave: boolean;
    autoSaveDelay: number;
    showInvisibles: boolean;
  };
  vault: {
    path: string;
    defaultNoteExtension: string;
    autoUpdateLinks: boolean;
    useMarkdownLinks: boolean;
  };
  audio: {
    inputDevice: string;
    outputDevice: string;
    sampleRate: number;
    channels: number;
    bitDepth: number;
    noiseReduction: boolean;
    autoSaveRecordings: boolean;
    recordingsPath: string;
  };
  keybindings: Record<string, string>;
  version: string;
}

const defaultSettings: Settings = {
  appearance: {
    theme: 'system',
    fontSize: 16,
    lineHeight: 1.6,
    fontFamily: 'Inter, system-ui, sans-serif',
    codeFontFamily: 'JetBrains Mono, monospace',
  },
  editor: {
    tabSize: 2,
    lineNumbers: true,
    lineWrapping: true,
    spellCheck: true,
    autoSave: true,
    autoSaveDelay: 1000,
    showInvisibles: false,
  },
  vault: {
    path: '',
    defaultNoteExtension: 'md',
    autoUpdateLinks: true,
    useMarkdownLinks: true,
  },
  audio: {
    inputDevice: 'default',
    outputDevice: 'default',
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    noiseReduction: true,
    autoSaveRecordings: true,
    recordingsPath: '',
  },
  keybindings: {
    'editor:save': 'mod+s',
    'editor:new-note': 'mod+n',
    'editor:bold': 'mod+b',
    'editor:italic': 'mod+i',
    'editor:undo': 'mod+z',
    'editor:redo': 'mod+shift+z',
    'editor:delete-line': 'mod+shift+k',
    'editor:toggle-comment': 'mod+/',
  },
  version: '0.1.0',
};

type SettingsContextType = {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // This will invoke a Tauri command to read settings from disk
        const savedSettings = await invoke<Partial<Settings>>('load_settings');
        
        // Merge with defaults, giving priority to saved settings
        setSettings({
          ...defaultSettings,
          ...savedSettings,
          appearance: {
            ...defaultSettings.appearance,
            ...(savedSettings.appearance || {}),
          },
          editor: {
            ...defaultSettings.editor,
            ...(savedSettings.editor || {}),
          },
          vault: {
            ...defaultSettings.vault,
            ...(savedSettings.vault || {}),
          },
          audio: {
            ...defaultSettings.audio,
            ...(savedSettings.audio || {}),
          },
          keybindings: {
            ...defaultSettings.keybindings,
            ...(savedSettings.keybindings || {}),
          },
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError(err instanceof Error ? err : new Error('Failed to load settings'));
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      
      // Save settings to disk via Tauri
      await invoke('save_settings', { settings: newSettings });
    } catch (err) {
      console.error('Failed to update settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to update settings'));
      throw err;
    }
  };

  const resetToDefaults = async () => {
    try {
      setSettings(defaultSettings);
      // Reset settings on disk via Tauri
      await invoke('reset_settings');
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to reset settings'));
      throw err;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetToDefaults,
        isLoading,
        error,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
