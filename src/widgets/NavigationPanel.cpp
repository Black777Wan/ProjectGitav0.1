#include "NavigationPanel.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QInputDialog>
#include <QMessageBox>

NavigationPanel::NavigationPanel(NoteDatabase* db, QWidget *parent)
    : QWidget(parent)
    , m_noteDb(db)
{
    // Create layout
    m_layout = new QVBoxLayout(this);
    m_layout->setContentsMargins(0, 0, 0, 0);
    m_layout->setSpacing(0);
    
    // Create header section with title
    QWidget* headerWidget = new QWidget(this);
    headerWidget->setObjectName("navigationHeader");
    headerWidget->setStyleSheet("#navigationHeader { background-color: #f8f9fa; border-bottom: 1px solid #e2e8f0; }");
    
    QVBoxLayout* headerLayout = new QVBoxLayout(headerWidget);
    headerLayout->setContentsMargins(16, 16, 16, 16);
    
    QLabel* titleLabel = new QLabel("YD-Notes", headerWidget);
    titleLabel->setStyleSheet("font-size: 18px; font-weight: bold; color: #2d3748;");
    headerLayout->addWidget(titleLabel);
    
    // Create search box
    m_searchBox = new QLineEdit(headerWidget);
    m_searchBox->setPlaceholderText("Search notes...");
    m_searchBox->setStyleSheet("padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 8px;");
    headerLayout->addWidget(m_searchBox);
    
    // Create new note button
    m_newNoteButton = new QPushButton("New Note", headerWidget);
    m_newNoteButton->setStyleSheet("padding: 8px; background-color: #3182ce; color: white; border: none; border-radius: 4px; margin-top: 8px;");
    headerLayout->addWidget(m_newNoteButton);
    
    m_layout->addWidget(headerWidget);
    
    // Create page list
    m_pageList = new PageList(this);
    m_pageList->setStyleSheet("background-color: white; border: none;");
    m_layout->addWidget(m_pageList);
    
    // Connect signals
    connect(m_searchBox, &QLineEdit::textChanged, this, &NavigationPanel::onSearchTextChanged);
    connect(m_newNoteButton, &QPushButton::clicked, this, &NavigationPanel::onCreateNewNote);
    connect(m_pageList, &PageList::noteSelected, this, &NavigationPanel::noteSelected);
    
    // Initial page list population
    refreshNoteList();
}

NavigationPanel::~NavigationPanel() {
}

void NavigationPanel::refreshNoteList() {
    QString searchText = m_searchBox->text();
    QList<Note> notes;
    
    if (searchText.isEmpty()) {
        notes = m_noteDb->getAllNotes();
    } else {
        notes = m_noteDb->searchNotes(searchText);
    }
    
    m_pageList->setNotes(notes);
}

void NavigationPanel::onSearchTextChanged(const QString& text) {
    refreshNoteList();
}

void NavigationPanel::onCreateNewNote() {
    bool ok;
    QString title = QInputDialog::getText(this, "New Note",
                                         "Enter note title:", QLineEdit::Normal,
                                         "Untitled Note", &ok);
    if (ok && !title.isEmpty()) {
        Note newNote;
        newNote.setTitle(title);
        newNote.setContent("# " + title + "\n\n");
        
        QString noteId = m_noteDb->addNote(newNote);
        refreshNoteList();
        emit noteSelected(noteId);
    }
}
