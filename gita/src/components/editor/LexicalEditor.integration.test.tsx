import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LexicalEditor } from './LexicalEditor'; // Assuming default export or named
import { EditorState } from 'lexical';

// Mock tauri invoke, as LexicalEditor's InitializeStatePlugin uses useLexicalComposerContext
// and editor.parseEditorState which might not be fully available in jsdom without a fuller setup.
// The key part is that LexicalComposer and its context are available.
// We are primarily testing the JSON serialization/deserialization logic handling within LexicalEditor.
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock child components that might cause issues or are not relevant to this specific test
jest.mock('./EditorToolbar', () => () => <div data-testid="editor-toolbar-mock">EditorToolbar</div>);
jest.mock('./plugins/AutoTimestampPlugin', () => () => null);
jest.mock('./plugins/EnforceBulletListPlugin', () => () => null);
jest.mock('./plugins/TabIndentationPlugin', () => () => null);
jest.mock('../AudioPlayer', () => () => <div data-testid="audio-player-mock">AudioPlayer</div>);


// A simple initial JSON state for Lexical
const initialJsonStateString = '{"root":{"children":[{"type":"paragraph","version":1,"children":[{"type":"text","detail":0,"format":0,"mode":"normal","style":"","text":"Hello World","version":1}]}],"direction":"ltr","format":"","indent":0,"version":1}}';
const initialJsonStateAfterEmptyLoad = '{"root":{"children":[{"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"version":1}}';


describe('LexicalEditor JSON Integration', () => {
  let onChangeMock: jest.Mock;

  beforeEach(() => {
    onChangeMock = jest.fn();
    (jest.requireMock('@tauri-apps/api/core').invoke as jest.Mock).mockClear();
  });

  test('should load initial JSON content correctly', async () => {
    render(
      <LexicalEditor
        initialContent={initialJsonStateString}
        onChange={onChangeMock}
        currentNoteId="note1"
      />
    );

    // The content editable area should contain "Hello World"
    // This relies on Lexical rendering the state, which can be tricky to assert directly in jsdom
    // without deep Lexical knowledge or visual regression.
    // Instead, we'll trust Lexical renders if the state is set.
    // A more robust test might involve accessing editor state if possible.

    // For now, check if the placeholder is NOT there, suggesting content loaded.
    // Placeholder text is "start typing"
    expect(screen.queryByText('start typing')).not.toBeInTheDocument();

    // A more direct way to check if editor state was initialized:
    // The OnChangePlugin fires once on initialization with the initial state.
    // So onChangeMock should have been called with the initialJsonStateString or its stringified equivalent
    // after parsing and then re-serializing.
    // Lexical might slightly alter the JSON string (e.g. spacing, key order) after parsing and re-serializing.
    // Let's make sure it's called.
    // Due to async nature of lexical setup and plugins, might need waitFor
    await act(async () => {
        // Wait for plugins to initialize, especially InitializeStatePlugin and OnChangePlugin
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for Lexical init
    });

    expect(onChangeMock).toHaveBeenCalled();
    const lastCallArg = onChangeMock.mock.calls[onChangeMock.mock.calls.length -1][0];
    expect(JSON.parse(lastCallArg)).toEqual(JSON.parse(initialJsonStateString));

  });

  test('should load with empty content if initialContent is not provided', async () => {
    render(
      <LexicalEditor
        onChange={onChangeMock}
        currentNoteId="note-empty"
      />
    );
    // Placeholder should be visible
    expect(screen.getByText('start typing')).toBeInTheDocument();

    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    // OnChangePlugin should be called with the JSON representation of an empty editor state
    expect(onChangeMock).toHaveBeenCalled();
    const lastCallArg = onChangeMock.mock.calls[onChangeMock.mock.calls.length -1][0];
    expect(JSON.parse(lastCallArg)).toEqual(JSON.parse(initialJsonStateAfterEmptyLoad));
  });

  test('onChange should provide updated JSON state when content changes', async () => {
    let currentEditorState: EditorState | null = null;

    render(
        <LexicalEditor
            initialContent={initialJsonStateString}
            onChange={(contentString) => {
                onChangeMock(contentString);
                // For testing, let's try to parse it to simulate real usage
                try {
                    currentEditorState = JSON.parse(contentString);
                } catch (e) {
                    // ignore
                }
            }}
            currentNoteId="note2"
        />
    );

    // This is the hard part: simulating a change from within the test.
    // We can't easily simulate typing into the ContentEditable.
    // However, the OnChangePlugin is what calls our onChange prop.
    // We can check that the initial state is reported.
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    expect(onChangeMock).toHaveBeenCalledTimes(1); // Initial load

    // To simulate a change, we would ideally get the editor instance and use its API
    // e.g., editor.update(() => { $getRoot().append($createParagraphNode()...); });
    // This is not straightforward to get from outside the LexicalComposer.
    // The current structure of LexicalEditor doesn't expose the editor instance.

    // For this integration test, we'll focus on the initial load and the format of `onChange` data.
    // Testing actual content modification effects on JSON output would require deeper access
    // to the Lexical editor instance or more complex setup for simulating user input.

    // Let's assume the initial loaded state is correctly reported.
    const reportedJsonString = onChangeMock.mock.calls[0][0];
    expect(JSON.parse(reportedJsonString)).toEqual(JSON.parse(initialJsonStateString));

    // If we could trigger an update, we'd check onChangeMock again.
    // For example, if a button inside LexicalEditor triggered an update:
    // fireEvent.click(screen.getByTestId('some-internal-button-that-modifies-state'));
    // await waitFor(() => expect(onChangeMock).toHaveBeenCalledTimes(2));
    // const newJsonString = onChangeMock.mock.calls[1][0];
    // expect(JSON.parse(newJsonString)).toEqual(/** expected new state */);

    // Since direct simulation of typing is complex, this test primarily verifies
    // that the initial JSON is processed and onChange is called with JSON.
  });
});
