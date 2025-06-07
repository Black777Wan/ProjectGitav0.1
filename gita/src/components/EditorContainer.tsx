import React, { useState, useEffect } from 'react';
import { FiLink, FiClock } from 'react-icons/fi'; // FiSave removed as not used
import { findBacklinks, getReferencesForBlock } from '../../api/fileSystem'; // Adjust path as needed
import { NoteMetadata, BlockReference } from '../../types'; // Adjust path as needed

interface EditorContainerProps {
  noteTitle: string;
  children: React.ReactNode;
  currentNoteId?: string; // Added currentNoteId prop
}

const EditorContainer: React.FC<EditorContainerProps> = ({
  noteTitle,
  children,
  currentNoteId,
}) => {
  const [backlinks, setBacklinks] = useState<NoteMetadata[]>([]);
  const [blockReferences, setBlockReferences] = useState<BlockReference[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [isLoadingBlockRefs, setIsLoadingBlockRefs] = useState(false);
  const [testBlockId, setTestBlockId] = useState<string>('');

  useEffect(() => {
    if (currentNoteId) {
      setIsLoadingBacklinks(true);
      findBacklinks(currentNoteId)
        .then(data => {
          // Data should conform to NoteMetadata[] directly.
          // Filter Boolean in case of unexpected nulls/undefined in array.
          setBacklinks(data.filter(Boolean));
        })
        .catch(error => {
          console.error("Failed to fetch backlinks:", error);
          setBacklinks([]); // Clear on error
        })
        .finally(() => setIsLoadingBacklinks(false));

      // Clear block references when note changes too
      setBlockReferences([]);
      setTestBlockId(''); // Reset test block ID input
    } else {
      setBacklinks([]);
      setBlockReferences([]);
    }
  }, [currentNoteId]);

  const handleFetchBlockReferences = () => {
    if (!testBlockId) {
      alert("Please enter a block ID.");
      return;
    }
    setIsLoadingBlockRefs(true);
    getReferencesForBlock(testBlockId)
      .then(data => setBlockReferences(data.filter(Boolean))) // Filter out undefined if any
      .catch(error => {
        console.error(`Failed to fetch references for block ${testBlockId}:`, error);
        setBlockReferences([]);
      })
      .finally(() => setIsLoadingBlockRefs(false));
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Editor header with title */}
      <div className="flex items-center justify-start p-2 border-b border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg">
        <h2 className="text-lg font-medium text-light-text dark:text-obsidian-text">{noteTitle}</h2>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto p-4"> {/* Added padding for content separation */}
        <div className="editor-content-area"> {/* Wrapper for main editor children */}
          {children}
        </div>

        {/* Backlinks Section */}
        <div className="mt-4 p-2 border rounded border-light-border dark:border-obsidian-border">
          <h3 className="text-md font-semibold mb-2">Backlinks:</h3>
          {isLoadingBacklinks && <p className="text-xs text-light-muted dark:text-obsidian-muted">Loading backlinks...</p>}
          {!isLoadingBacklinks && backlinks.length === 0 && <p className="text-xs text-light-muted dark:text-obsidian-muted">No backlinks to this page.</p>}
          <ul className="list-disc list-inside text-xs">
            {backlinks.map(link => (
              <li key={link.id} className="mb-1">
                {link.title || 'Untitled Page'} (ID: {link.id})
              </li>
            ))}
          </ul>
        </div>

        {/* Block References Test Section */}
        <div className="mt-4 p-2 border rounded border-light-border dark:border-obsidian-border">
          <h3 className="text-md font-semibold mb-2">Test References to a Block:</h3>
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="text"
              value={testBlockId}
              onChange={(e) => setTestBlockId(e.target.value)}
              placeholder="Enter Block ID"
              className="flex-grow p-1 border rounded bg-light-bg dark:bg-obsidian-input border-light-border dark:border-obsidian-border text-xs"
            />
            <button
              onClick={handleFetchBlockReferences}
              className="p-1 px-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
            >
              Fetch References
            </button>
          </div>
          {isLoadingBlockRefs && <p className="text-xs text-light-muted dark:text-obsidian-muted">Loading block references...</p>}
          {!isLoadingBlockRefs && blockReferences.length === 0 && testBlockId && <p className="text-xs text-light-muted dark:text-obsidian-muted">No references to this block.</p>}
          {!isLoadingBlockRefs && blockReferences.length === 0 && !testBlockId && <p className="text-xs text-light-muted dark:text-obsidian-muted">Enter a block ID to see references.</p>}
          <ul className="list-disc list-inside text-xs">
            {blockReferences.map(ref => (
              <li key={ref.id} className="mb-1">
                Ref ID: {ref.id}, From Page: {ref.referencing_page_id}, From Block: {ref.referencing_block_id}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Editor footer */}
      <div className="flex items-center justify-between p-2 border-t border-light-border dark:border-obsidian-border bg-light-bg dark:bg-obsidian-bg text-xs text-light-muted dark:text-obsidian-muted">
        <div className="flex items-center">
          <FiClock className="mr-1" /> Last modified: Today at 10:30 AM {/* This is still static */}
        </div>
        <div className="flex items-center">
          <FiLink className="mr-1" /> {isLoadingBacklinks ? '...' : backlinks.length} backlinks
        </div>
      </div>
    </div>
  );
};

export default EditorContainer;

