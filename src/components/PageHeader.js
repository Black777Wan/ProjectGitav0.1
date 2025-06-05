import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

const HeaderContainer = styled.div`
  padding: 24px 32px 16px 32px;
  border-bottom: 1px solid #e2e8f0;
  background-color: white;
`;

const TitleInput = styled.input`
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  border: none;
  outline: none;
  background: transparent;
  width: 100%;
  padding: 8px 0;
  margin-bottom: 8px;

  &:focus {
    background-color: #f7fafc;
    border-radius: 6px;
    padding: 8px 12px;
  }

  &::placeholder {
    color: #a0aec0;
  }
`;

const PageMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: #718096;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Badge = styled.span`
  background-color: #e6fffa;
  color: #234e52;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
`;

function PageHeader({ page, onPageUpdate }) {
  const [title, setTitle] = useState(page?.title || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTitle(page?.title || '');
  }, [page?.title]);

  const handleTitleSave = async () => {
    if (title.trim() && title !== page.title) {
      await onPageUpdate(page.id, { ...page, title: title.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitle(page.title);
      setIsEditing(false);
    }
  };

  if (!page) return null;

  const createdDate = new Date(page.created_at);
  const updatedDate = new Date(page.updated_at);
  const isRecentlyUpdated = updatedDate.getTime() !== createdDate.getTime();

  return (
    <HeaderContainer>
      <TitleInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={handleTitleSave}
        onKeyDown={handleKeyPress}
        placeholder="Untitled Page"
      />
      
      <PageMeta>
        <MetaItem>
          📅 Created {format(createdDate, 'MMM d, yyyy')}
        </MetaItem>
        
        {isRecentlyUpdated && (
          <MetaItem>
            ✏️ Updated {format(updatedDate, 'MMM d, yyyy')}
          </MetaItem>
        )}
        
        {page.is_daily_note && (
          <Badge>Daily Note</Badge>
        )}
      </PageMeta>
    </HeaderContainer>
  );
}

export default PageHeader;
