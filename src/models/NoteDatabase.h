#ifndef NOTEDATABASE_H
#define NOTEDATABASE_H

#include <QObject>
#include <QMap>
#include "Note.h"

class NoteDatabase : public QObject {
    Q_OBJECT

public:
    explicit NoteDatabase(QObject *parent = nullptr);
    ~NoteDatabase();
    
    QList<Note> getAllNotes() const;
    Note getNoteById(const QString& id) const;
    QString addNote(const Note& note);
    bool updateNote(const Note& note);
    bool deleteNote(const QString& id);
    
    QList<Note> searchNotes(const QString& query) const;
    QList<QString> getBacklinks(const QString& noteId) const;
    
    bool saveToFile(const QString& filePath);
    bool loadFromFile(const QString& filePath);
    
signals:
    void noteAdded(const QString& noteId);
    void noteUpdated(const QString& noteId);
    void noteDeleted(const QString& noteId);
    
private:
    QMap<QString, Note> m_notes;
    
    // Helper methods
    void parseLinks(const QString& content, QStringList& links) const;
};

#endif // NOTEDATABASE_H
