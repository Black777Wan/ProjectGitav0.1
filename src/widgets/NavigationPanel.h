#ifndef NAVIGATIONPANEL_H
#define NAVIGATIONPANEL_H

#include <QWidget>
#include <QVBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include "PageList.h"
#include "../models/NoteDatabase.h"

class NavigationPanel : public QWidget {
    Q_OBJECT

public:
    explicit NavigationPanel(NoteDatabase* db, QWidget *parent = nullptr);
    ~NavigationPanel();
    
    void refreshNoteList();
    
signals:
    void noteSelected(const QString& noteId);
    
private slots:
    void onSearchTextChanged(const QString& text);
    void onCreateNewNote();
    
private:
    QVBoxLayout* m_layout;
    QLineEdit* m_searchBox;
    QPushButton* m_newNoteButton;
    PageList* m_pageList;
    NoteDatabase* m_noteDb;
};

#endif // NAVIGATIONPANEL_H
