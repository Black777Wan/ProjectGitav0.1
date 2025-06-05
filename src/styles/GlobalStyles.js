import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #fafafa;
    color: #2d3748;
    line-height: 1.6;
  }

  #root {
    height: 100vh;
    overflow: hidden;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* Editor styles */
  .ProseMirror {
    outline: none;
    padding: 20px;
    font-size: 16px;
    line-height: 1.6;
  }

  .ProseMirror ul {
    list-style: none;
    padding-left: 0;
  }

  .ProseMirror li {
    position: relative;
    padding-left: 24px;
    margin: 4px 0;
  }

  .ProseMirror li:before {
    content: '•';
    position: absolute;
    left: 8px;
    color: #666;
    font-weight: bold;
  }

  .ProseMirror li ul {
    margin-left: 24px;
    margin-top: 4px;
  }

  .ProseMirror p {
    margin: 8px 0;
  }

  .ProseMirror h1 {
    font-size: 24px;
    font-weight: 600;
    margin: 16px 0 12px 0;
    color: #1a202c;
  }

  .ProseMirror h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 14px 0 10px 0;
    color: #2d3748;
  }

  .ProseMirror strong {
    font-weight: 600;
  }

  .ProseMirror em {
    font-style: italic;
  }

  .ProseMirror code {
    background-color: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
  }

  /* Page links */
  .page-link {
    color: #3182ce;
    text-decoration: none;
    border-bottom: 1px solid rgba(49, 130, 206, 0.3);
    padding: 1px 2px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .page-link:hover {
    background-color: rgba(49, 130, 206, 0.1);
    border-bottom-color: #3182ce;
  }

  /* Button styles */
  button {
    font-family: inherit;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }

  button:focus {
    outline: 2px solid #3182ce;
    outline-offset: 2px;
  }

  .btn-primary {
    background-color: #3182ce;
    color: white;
  }

  .btn-primary:hover {
    background-color: #2c5aa0;
  }

  .btn-secondary {
    background-color: #e2e8f0;
    color: #2d3748;
  }

  .btn-secondary:hover {
    background-color: #cbd5e0;
  }

  .btn-ghost {
    background-color: transparent;
    color: #4a5568;
    padding: 6px 12px;
  }

  .btn-ghost:hover {
    background-color: #f7fafc;
  }

  /* Input styles */
  input, textarea {
    font-family: inherit;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
    transition: border-color 0.2s ease;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
  }
`;
