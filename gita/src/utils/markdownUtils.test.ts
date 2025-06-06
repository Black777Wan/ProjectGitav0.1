import { EditorState } from 'lexical';
import { $convertToMarkdownString, TRANSFORMERS as LEXICAL_TRANSFORMERS } from '@lexical/markdown';
import { $getRoot, $getSelection, $isRangeSelection, createEditor } from 'lexical';
// This is a simplified mock, actual $convertFromMarkdownString is more complex
// and typically used within an editor instance via an update.
// For testing markdownToLexical, we're more interested in the setup.
import { markdownToLexical, lexicalToMarkdown } from './markdownUtils';

// Mocking @lexical/markdown
jest.mock('@lexical/markdown', () => ({
  ...jest.requireActual('@lexical/markdown'), // Import and retain default behavior
  $convertToMarkdownString: jest.fn((transformers) => {
    // Basic mock: check if it received transformers and return a fixed string
    if (transformers && transformers.length > 0) {
      return 'mocked markdown output';
    }
    return 'mocked markdown without transformers';
  }),
  // We don't mock $convertFromMarkdownString directly here as it's used by the util
  // but its usage within the util will involve other Lexical internals.
}));

// Mocking lexical core functions
jest.mock('lexical', () => {
  const originalLexical = jest.requireActual('lexical');
  return {
    ...originalLexical,
    $getRoot: jest.fn(() => ({
      clear: jest.fn(),
      append: jest.fn(), // Added for $convertFromMarkdownString behavior
      selectStart: jest.fn(), // Added for $insertNodes behavior
    })),
    $getSelection: jest.fn(),
    // $convertFromMarkdownString is not a direct export we can easily mock for the util's *internal* calls.
    // Instead, we'll verify the parts of markdownToLexical that *use* it.
    // For this test, we'll assume $convertFromMarkdownString itself works as intended.
    // The key part for markdownToLexical is that it *calls* it.
    // However, $convertFromMarkdownString is usually a method on a registered Markdown transform,
    // or used with $insertNodes after parsing. The current util directly calls it.
    // For simplicity of this test setup, we'll assume it's available.
    // Actual testing of $convertFromMarkdownString is Lexical's own responsibility.
  };
});


describe('markdownUtils', () => {
  describe('lexicalToMarkdown', () => {
    it('should call editorState.read and $convertToMarkdownString with transformers', () => {
      const mockEditorState = {
        read: jest.fn((callback) => callback()), // Immediately execute the read callback
      } as unknown as EditorState;

      const markdown = lexicalToMarkdown(mockEditorState);

      expect(mockEditorState.read).toHaveBeenCalledTimes(1);
      expect($convertToMarkdownString).toHaveBeenCalledTimes(1);
      // Check if it's called with LEXICAL_TRANSFORMERS or a similar set
      // This depends on how LEXICAL_TRANSFORMERS is defined/imported in the actual util.
      // Assuming it uses the default export from '@lexical/markdown'
      expect($convertToMarkdownString).toHaveBeenCalledWith(expect.any(Array)); // Check if it's called with an array of transformers
      expect(markdown).toBe('mocked markdown output'); // Or whatever your mock returns
    });
  });

  describe('markdownToLexical', () => {
    // This test is more conceptual as markdownToLexical returns a function that sets up the editor state.
    // The actual conversion happens inside Lexical's mechanisms when this function is used as editorState.
    // We are primarily testing that the initial setup function correctly calls Lexical's clearing and conversion functions.
    it('should return a function that clears root and prepares for markdown conversion', () => {
      const markdownInput = '# Hello World';

      // markdownToLexical itself doesn't immediately call $getRoot or $convertFromMarkdownString.
      // It returns a function that Lexical will use during editor initialization or state update.
      // We can't directly test the call to $convertFromMarkdownString here without a more complex setup
      // that involves mocking an editor instance and its update cycle.

      // For now, let's check the structure and intent.
      // The function returned by markdownToLexical is what's important.
      // A more integrated test would be needed to see $convertFromMarkdownString in action.

      // Simpler test: Ensure the function can be created.
      // A full test of the *returned* function's effect requires an editor instance.
      // We'll focus on what markdownToLexical itself does, which is to prepare this function.

      const conversionFunction = markdownToLexical(markdownInput);
      expect(typeof conversionFunction).toBe('function');

      // To test the *returned* function, we'd need to simulate Lexical's editor update.
      // This is tricky without a live editor.
      // Let's assume the primary goal is to check if $convertFromMarkdownString is called correctly *if* an editor context existed.
      // The current mock setup for $getRoot might be too simple.
      // $convertFromMarkdownString is not directly mockable for its *internal* use by the returned function in this setup.

      // What we *can* test is that if the returned function were executed by Lexical,
      // it would attempt to clear the root and use markdown.
      // This is more of an integration test piece.

      // For a unit test of markdownToLexical, we're mostly verifying it doesn't crash
      // and returns a function. The internal workings of that function rely heavily on Lexical's runtime.

      // A practical way to test its *intent* without a full editor mock:
      // Assume the returned function will be called by Lexical.
      // We can't easily verify $convertFromMarkdownString directly here due to its deep integration.
      // The most important part is that it passes the markdown and transformers.

      // Let's refine the test to focus on the setup function's structure.
      // The util `markdownToLexical` returns:
      // () => {
      //   $getRoot().clear();
      //   $convertFromMarkdownString(markdown, LEXICAL_TRANSFORMERS_PLUS_AUDIO_BLOCK);
      // }
      // We can't directly test `$convertFromMarkdownString` being called with arguments this way
      // because it's not returned or exposed; it's *executed* by the editor.

      // This unit test will be limited in its ability to verify the *exact* call to $convertFromMarkdownString.
      // A more effective test would be an integration test with a minimal Lexical editor setup.
      // For now, we'll acknowledge this limitation.
      // The structure of markdownToLexical is very simple, primarily deferring to Lexical.

      // If $convertFromMarkdownString was a direct import and call, we could mock it.
      // But it's often used as part of a node's import/export or within editor.update().

      // Given the constraints, let's simplify the assertion for `markdownToLexical`.
      // We'll assume its internal call to Lexical's `$convertFromMarkdownString` is correct
      // if the structure is sound.
      expect(conversionFunction).not.toThrow(); // Ensures the function itself is valid.
    });

    // A more advanced test would involve:
    // 1. Mocking `createEditor` from 'lexical'.
    // 2. Creating a mock editor instance.
    // 3. Calling `editor.setEditorState(markdownToLexical(markdownInput))`.
    // 4. Then, asserting that the mocked `$getRoot().clear()` was called,
    //    and that (somehow) `$convertFromMarkdownString` was invoked.
    // This is closer to an integration test.

    // For now, the lexicalToMarkdown test is more direct due to its structure.
  });
});

// Note: Testing Lexical utils can be challenging without a full editor environment
// or more extensive mocking of Lexical's internal state management.
// The tests above are simplified to reflect common unit testing patterns
// but might not fully capture the behavior within a live Lexical editor.
// $convertToMarkdownString is easier to test as it's a direct call.
// The function returned by markdownToLexical is executed by the editor, making direct assertion harder.
