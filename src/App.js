import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { format } from 'date-fns';

import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import PageHeader from './components/PageHeader';
import { usePages } from './hooks/usePages';

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: #fafafa;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const EditorContainer = styled.div`
  flex: 1;
  overflow: auto;
  background-color: white;
  margin: 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

function App() {
  const [currentPage, setCurrentPage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { pages, loadPages, createPage, updatePage } = usePages();

  useEffect(() => {
    loadPages().then(() => {
      setIsLoading(false);
    });
  }, [loadPages]);

  const handlePageSelect = async (page) => {
    setCurrentPage(page);
  };

  const handleDailyNotesClick = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      const dailyNote = await window.electronAPI.getDailyNote(today);
      setCurrentPage(dailyNote);
    } catch (error) {
      console.error('Error loading daily note:', error);
    }
  };

  const handleNewPage = async (title) => {
    try {
      const newPage = await createPage({ title });
      setCurrentPage(newPage);
      return newPage;
    } catch (error) {
      console.error('Error creating page:', error);
    }
  };

  const handlePageUpdate = async (pageId, pageData) => {
    try {
      const updatedPage = await updatePage(pageId, pageData);
      if (currentPage && currentPage.id === pageId) {
        setCurrentPage(updatedPage);
      }
    } catch (error) {
      console.error('Error updating page:', error);
    }
  };

  if (isLoading) {
    return (
      <AppContainer>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          width: '100%', 
          height: '100%',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading Ananta Notes...
        </div>
      </AppContainer>
    );
  }

  return (
    <Router>
      <AppContainer>
        <Sidebar
          pages={pages}
          currentPage={currentPage}
          onPageSelect={handlePageSelect}
          onDailyNotesClick={handleDailyNotesClick}
          onNewPage={handleNewPage}
        />
        <MainContent>
          <Routes>
            <Route 
              path="/" 
              element={
                currentPage ? (
                  <>
                    <PageHeader 
                      page={currentPage} 
                      onPageUpdate={handlePageUpdate}
                    />
                    <EditorContainer>
                      <Editor 
                        page={currentPage} 
                        onPageUpdate={handlePageUpdate}
                      />
                    </EditorContainer>
                  </>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    flexDirection: 'column',
                    color: '#666'
                  }}>
                    <h2 style={{ marginBottom: '16px' }}>Welcome to Ananta Notes</h2>
                    <p>Select a page from the sidebar or create a new one to get started.</p>
                  </div>
                )
              } 
            />
          </Routes>
        </MainContent>
      </AppContainer>
    </Router>
  );
}

export default App;
