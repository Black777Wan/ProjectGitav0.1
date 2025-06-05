import React, { useState } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

const SidebarContainer = styled.div`
  width: 280px;
  background-color: #f8f9fa;
  border-right: 1px solid #e2e8f0;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  margin-bottom: 24px;
`;

const AppTitle = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 8px;
`;

const AppSubtitle = styled.p`
  font-size: 14px;
  color: #718096;
`;

const ActionButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
`;

const ActionButton = styled.button`
  background-color: ${props => props.primary ? '#3182ce' : '#e2e8f0'};
  color: ${props => props.primary ? 'white' : '#2d3748'};
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    background-color: ${props => props.primary ? '#2c5aa0' : '#cbd5e0'};
  }

  &:focus {
    outline: 2px solid #3182ce;
    outline-offset: 2px;
  }
`;

const NewPageInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 8px;

  &:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
  }
`;

const PagesSection = styled.div`
  flex: 1;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PagesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PageItem = styled.div`
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #2d3748;
  background-color: ${props => props.active ? '#e6fffa' : 'transparent'};
  border: 1px solid ${props => props.active ? '#38b2ac' : 'transparent'};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.active ? '#e6fffa' : '#f7fafc'};
  }

  /* Truncate long titles */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DailyNoteIndicator = styled.span`
  background-color: #fbb6ce;
  color: #702459;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
  font-weight: 500;
`;

function Sidebar({ pages, currentPage, onPageSelect, onDailyNotesClick, onNewPage }) {
  const [newPageTitle, setNewPageTitle] = useState('');
  const [showNewPageInput, setShowNewPageInput] = useState(false);

  const handleNewPageSubmit = async (e) => {
    e.preventDefault();
    if (newPageTitle.trim()) {
      await onNewPage(newPageTitle.trim());
      setNewPageTitle('');
      setShowNewPageInput(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNewPageSubmit(e);
    } else if (e.key === 'Escape') {
      setShowNewPageInput(false);
      setNewPageTitle('');
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <SidebarContainer>
      <SidebarHeader>
        <AppTitle>Ananta</AppTitle>
        <AppSubtitle>Smart note-taking with audio</AppSubtitle>
      </SidebarHeader>

      <ActionButtons>
        <ActionButton primary onClick={onDailyNotesClick}>
          📅 Daily Notes ({today})
        </ActionButton>
        
        {showNewPageInput ? (
          <form onSubmit={handleNewPageSubmit}>
            <NewPageInput
              type="text"
              placeholder="Enter page title..."
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
            />
            <ActionButton type="submit" disabled={!newPageTitle.trim()}>
              Create Page
            </ActionButton>
          </form>
        ) : (
          <ActionButton onClick={() => setShowNewPageInput(true)}>
            ➕ New Page
          </ActionButton>
        )}
      </ActionButtons>

      <PagesSection>
        <SectionTitle>Pages</SectionTitle>
        <PagesList>
          {pages.length === 0 ? (
            <div style={{ 
              padding: '20px 12px', 
              textAlign: 'center', 
              color: '#718096',
              fontSize: '14px'
            }}>
              No pages yet. Create your first page above!
            </div>
          ) : (
            pages.map(page => (
              <PageItem
                key={page.id}
                active={currentPage && currentPage.id === page.id}
                onClick={() => onPageSelect(page)}
                title={page.title}
              >
                {page.title}
                {page.is_daily_note && <DailyNoteIndicator>Daily</DailyNoteIndicator>}
              </PageItem>
            ))
          )}
        </PagesList>
      </PagesSection>
    </SidebarContainer>
  );
}

export default Sidebar;
