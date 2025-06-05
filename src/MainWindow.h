#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QSplitter>
#include "widgets/NavigationPanel.h"
#include "editor/MarkdownEditor.h"
#include "models/NoteDatabase.h"

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onNoteSelected(const QString& noteId);
    void onSaveRequested();
    void onNewNoteRequested();

private:
    void setupUi();
    void setupMenus();
    void connectSignals();

    QSplitter* m_mainSplitter;
    NavigationPanel* m_navigationPanel;
    MarkdownEditor* m_editor;
    NoteDatabase* m_noteDb;
    QString m_currentNoteId;
};

#endif // MAINWINDOW_H
