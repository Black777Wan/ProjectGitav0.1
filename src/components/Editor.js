import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import styled from 'styled-components';
import { PageLinks } from './PageLinks';

const EditorContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const EditorWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;

  .ProseMirror {
    height: 100%;
    min-height: 500px;
    padding: 32px;
    outline: none;
    font-size: 16px;
    line-height: 1.6;
    color: #2d3748;

    /* Custom bullet list styling */
    ul[data-type="bulletList"] {
      list-style: none;
      padding-left: 0;
      margin-left: 0;
    }

    li[data-type="listItem"] {
      position: relative;
      padding-left: 28px;
      margin: 6px 0;
      min-height: 1.5em;

      &::before {
        content: '•';
        position: absolute;
        left: 12px;
        top: 0;
        color: #4a5568;
        font-weight: bold;
        font-size: 18px;
        line-height: 1.5;
      }

      /* Nested lists */
      ul {
        margin-left: 28px;
        margin-top: 6px;
        margin-bottom: 6px;
      }

      /* Different bullet styles for nested levels */
      ul li::before {
        content: '◦';
        font-size: 16px;
      }

      ul ul li::before {
        content: '▪';
        font-size: 14px;
      }
    }

    /* Empty placeholder for empty list items */
    li[data-type="listItem"] p.is-empty::before {
      content: 'Type your note here...';
      color: #a0aec0;
      pointer-events: none;
      position: absolute;
    }

    /* First empty item gets different placeholder */
    li[data-type="listItem"]:first-child p.is-empty::before {
      content: 'Start typing your notes...';
    }

    /* Paragraph styling */
    p {
      margin: 8px 0;
    }

    p.is-empty::before {
      content: 'Start writing...';
      color: #a0aec0;
      pointer-events: none;
    }

    /* Heading styles */
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 24px 0 16px 0;
      color: #1a202c;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin: 20px 0 12px 0;
      color: #2d3748;
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 16px 0 10px 0;
      color: #2d3748;
    }

    /* Text formatting */
    strong {
      font-weight: 600;
      color: #1a202c;
    }

    em {
      font-style: italic;
    }

    code {
      background-color: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      font-size: 14px;
      color: #2d3748;
    }

    /* Blockquote */
    blockquote {
      border-left: 4px solid #e2e8f0;
      padding-left: 16px;
      margin: 16px 0;
      font-style: italic;
      color: #4a5568;
    }

    /* Link styling (for future page links) */
    a {
      color: #3182ce;
      text-decoration: none;
      border-bottom: 1px solid rgba(49, 130, 206, 0.3);
      padding: 1px 2px;
      border-radius: 2px;
      transition: all 0.2s ease;

      &:hover {
        background-color: rgba(49, 130, 206, 0.1);
        border-bottom-color: #3182ce;
      }
    }
  }
`;

const Toolbar = styled.div`
  padding: 16px 32px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8f9fa;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ToolbarButton = styled.button`
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: ${props => props.active ? '#3182ce' : 'white'};
  color: ${props => props.active ? 'white' : '#2d3748'};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.active ? '#2c5aa0' : '#f7fafc'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

function Editor({ page, onPageUpdate, onPageNavigate }) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false, // We'll use our custom one
      }),
      BulletList.configure({
        HTMLAttributes: {
          'data-type': 'bulletList',
        },
      }),
      ListItem.configure({
        HTMLAttributes: {
          'data-type': 'listItem',
        },
      }),
      PageLinks,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      setContent(newContent);
      debouncedSave(newContent);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
  });

  // Simple debounce for auto-saving
  const debouncedSave = React.useCallback(
    debounce(async (newContent) => {
      if (page && newContent !== page.content) {
        setIsSaving(true);
        try {
          await onPageUpdate(page.id, { ...page, content: newContent });
        } catch (error) {
          console.error('Error saving page:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 1000),
    [page, onPageUpdate]
  );
  useEffect(() => {
    if (page && editor && page.content !== content) {
      setContent(page.content || '');
      editor.commands.setContent(page.content || '<ul><li><p></p></li></ul>');
    }
  }, [page, editor, content]);

  // Handle page link clicks
  useEffect(() => {
    const handlePageLink = (event) => {
      const { pageName } = event.detail;
      if (onPageNavigate) {
        onPageNavigate(pageName);
      }
    };

    if (editorRef.current) {
      editorRef.current.addEventListener('pageLink', handlePageLink);
      return () => {
        if (editorRef.current) {
          editorRef.current.removeEventListener('pageLink', handlePageLink);
        }
      };
    }
  }, [onPageNavigate]);

  if (!editor || !page) {
    return (
      <EditorContainer>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#718096'
        }}>
          Loading editor...
        </div>
      </EditorContainer>
    );
  }

  return (
    <EditorContainer>
      <Toolbar>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          Bold
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          Italic
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
        >
          Code
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          Bullet List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolbarButton>
        
        {isSaving && (
          <div style={{ 
            marginLeft: 'auto', 
            fontSize: '14px', 
            color: '#718096',
            display: 'flex',
            alignItems: 'center'
          }}>
            Saving...
          </div>
        )}
      </Toolbar>      <EditorWrapper ref={editorRef}>
        <EditorContent editor={editor} />
      </EditorWrapper>
    </EditorContainer>
  );
}

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default Editor;
