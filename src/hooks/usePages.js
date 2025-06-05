import { useState, useCallback } from 'react';

export const usePages = () => {
  const [pages, setPages] = useState([]);

  const loadPages = useCallback(async () => {
    try {
      const fetchedPages = await window.electronAPI.getPages();
      setPages(fetchedPages);
      return fetchedPages;
    } catch (error) {
      console.error('Error loading pages:', error);
      return [];
    }
  }, []);

  const createPage = useCallback(async (pageData) => {
    try {
      const newPage = await window.electronAPI.createPage(pageData);
      setPages(prev => [newPage, ...prev]);
      return newPage;
    } catch (error) {
      console.error('Error creating page:', error);
      throw error;
    }
  }, []);

  const updatePage = useCallback(async (pageId, pageData) => {
    try {
      const updatedPage = await window.electronAPI.updatePage(pageId, pageData);
      setPages(prev => prev.map(page => 
        page.id === pageId ? updatedPage : page
      ));
      return updatedPage;
    } catch (error) {
      console.error('Error updating page:', error);
      throw error;
    }
  }, []);

  const getPageByTitle = useCallback(async (title) => {
    try {
      return await window.electronAPI.getPageByTitle(title);
    } catch (error) {
      console.error('Error getting page by title:', error);
      return null;
    }
  }, []);

  return {
    pages,
    loadPages,
    createPage,
    updatePage,
    getPageByTitle
  };
};
