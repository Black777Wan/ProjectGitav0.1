#include "MainWindow.h"
#include <QMenuBar>
#include <QStatusBar>
#include <QFileDialog>
#include <QMessageBox>
#include <QApplication>
#include <QVBoxLayout>
#include <QInputDialog>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_currentNoteId("")
{
    m_noteDb = new NoteDatabase(this);
    setupUi();
    setupMenus();
    connectSignals();
    
    setWindowTitle("YD-Notes");
    resize(1200, 800);
}

MainWindow::~MainWindow() {
}

void MainWindow::setupUi() {
    m_mainSplitter = new QSplitter(Qt::Horizontal, this);
    
    // Create navigation panel (left side)
    m_navigationPanel = new NavigationPanel(m_noteDb, this);
    m_mainSplitter->addWidget(m_navigationPanel);
    
    // Create editor (right side)
    m_editor = new MarkdownEditor(this);
    m_mainSplitter->addWidget(m_editor);
    
    // Set default sizes
    m_mainSplitter->setSizes(QList<int>() << 300 << 900);
    
    setCentralWidget(m_mainSplitter);
    
    // Status bar setup
    statusBar()->showMessage("Ready");
}

void MainWindow::setupMenus() {
    // File menu
    QMenu* fileMenu = menuBar()->addMenu("&File");
    
    QAction* newAction = fileMenu->addAction("&New Note");
    newAction->setShortcut(QKeySequence::New);
    connect(newAction, &QAction::triggered, this, &MainWindow::onNewNoteRequested);
    
    QAction* saveAction = fileMenu->addAction("&Save");
    saveAction->setShortcut(QKeySequence::Save);
    connect(saveAction, &QAction::triggered, this, &MainWindow::onSaveRequested);
    
    fileMenu->addSeparator();
    
    QAction* exitAction = fileMenu->addAction("E&xit");
    exitAction->setShortcut(QKeySequence::Quit);
    connect(exitAction, &QAction::triggered, this, &QWidget::close);
    
    // Edit menu
    QMenu* editMenu = menuBar()->addMenu("&Edit");
    
    // Will add actions for formatting text, creating links, etc.
    
    // View menu
    QMenu* viewMenu = menuBar()->addMenu("&View");
    
    // Will add actions for toggling views
}

void MainWindow::connectSignals() {
    connect(m_navigationPanel, &NavigationPanel::noteSelected, 
            this, &MainWindow::onNoteSelected);
    
    connect(m_editor, &MarkdownEditor::contentChanged,
            this, &MainWindow::onSaveRequested);
}

void MainWindow::onNoteSelected(const QString& noteId) {
    if (!m_currentNoteId.isEmpty()) {
        // Save current note before switching
        onSaveRequested();
    }
    
    m_currentNoteId = noteId;
    
    if (!noteId.isEmpty()) {
        Note note = m_noteDb->getNoteById(noteId);
        m_editor->setContent(note.content());
        m_editor->setEnabled(true);
        statusBar()->showMessage(QString("Editing: %1").arg(note.title()));
    } else {
        m_editor->setContent("");
        m_editor->setEnabled(false);
        statusBar()->showMessage("No note selected");
    }
}

void MainWindow::onSaveRequested() {
    if (!m_currentNoteId.isEmpty()) {
        Note note = m_noteDb->getNoteById(m_currentNoteId);
        note.setContent(m_editor->content());
        m_noteDb->updateNote(note);
        statusBar()->showMessage("Note saved", 2000);
    }
}

void MainWindow::onNewNoteRequested() {
    bool ok;
    QString title = QInputDialog::getText(this, "New Note",
                                         "Enter note title:", QLineEdit::Normal,
                                         "Untitled Note", &ok);
    if (ok && !title.isEmpty()) {
        Note newNote;
        newNote.setTitle(title);
        newNote.setContent("# " + title + "\n\n");
        
        QString noteId = m_noteDb->addNote(newNote);
        m_navigationPanel->refreshNoteList();
        onNoteSelected(noteId);
    }
}
