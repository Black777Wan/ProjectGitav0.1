#include "NoteDatabase.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QRegularExpression>
#include <QRegularExpressionMatchIterator>
#include <QDebug>

NoteDatabase::NoteDatabase(QObject *parent)
    : QObject(parent)
{
    // Create a default welcome note for new databases
    if (m_notes.isEmpty()) {
        Note welcomeNote;
        welcomeNote.setTitle("Welcome to YD-Notes");
        welcomeNote.setContent("# Welcome to YD-Notes\n\n"
                              "This is your first note. You can edit it to get started.\n\n"
                              "## Features\n\n"
                              "- Bullet lists\n"
                              "- Nested lists\n  - Like this one\n  - And this one\n"
                              "- Markdown formatting\n"
                              "- Wiki-style links: [[Another Note]]\n\n"
                              "## Tips\n\n"
                              "- Use **bold** for emphasis\n"
                              "- Use *italic* for subtle emphasis\n"
                              "- Use `code` for inline code\n"
                              "- Use # for headings\n"
                              "- Use [[brackets]] for page links\n");
        addNote(welcomeNote);
    }
}

NoteDatabase::~NoteDatabase() {
}

QList<Note> NoteDatabase::getAllNotes() const {
    return m_notes.values();
}

Note NoteDatabase::getNoteById(const QString& id) const {
    if (m_notes.contains(id)) {
        return m_notes[id];
    }
    return Note(); // Return empty note if not found
}

QString NoteDatabase::addNote(const Note& note) {
    QString id = note.id();
    m_notes.insert(id, note);
    emit noteAdded(id);
    return id;
}

bool NoteDatabase::updateNote(const Note& note) {
    QString id = note.id();
    if (m_notes.contains(id)) {
        m_notes[id] = note;
        emit noteUpdated(id);
        return true;
    }
    return false;
}

bool NoteDatabase::deleteNote(const QString& id) {
    if (m_notes.contains(id)) {
        m_notes.remove(id);
        emit noteDeleted(id);
        return true;
    }
    return false;
}

QList<Note> NoteDatabase::searchNotes(const QString& query) const {
    QList<Note> results;
    
    if (query.isEmpty()) {
        return getAllNotes();
    }
    
    QString queryLower = query.toLower();
    
    for (const Note& note : m_notes) {
        if (note.title().toLower().contains(queryLower) || 
            note.content().toLower().contains(queryLower)) {
            results.append(note);
        }
    }
    
    return results;
}

QList<QString> NoteDatabase::getBacklinks(const QString& noteId) const {
    QList<QString> backlinks;
    
    Note targetNote = getNoteById(noteId);
    if (targetNote.id().isEmpty()) {
        return backlinks;
    }
    
    QString title = targetNote.title();
    
    // Look for links to this note in all other notes
    for (const Note& note : m_notes) {
        if (note.id() != noteId) {
            // Look for wiki-style links [[Title]]
            QRegularExpression linkRegex("\\[\\[" + QRegularExpression::escape(title) + "\\]\\]");
            if (note.content().contains(linkRegex)) {
                backlinks.append(note.id());
            }
        }
    }
    
    return backlinks;
}

bool NoteDatabase::saveToFile(const QString& filePath) {
    QJsonObject rootObject;
    QJsonArray notesArray;
    
    for (const Note& note : m_notes) {
        QJsonObject noteObject;
        noteObject["id"] = note.id();
        noteObject["title"] = note.title();
        noteObject["content"] = note.content();
        noteObject["createdAt"] = note.createdAt().toString(Qt::ISODate);
        noteObject["updatedAt"] = note.updatedAt().toString(Qt::ISODate);
        
        notesArray.append(noteObject);
    }
    
    rootObject["notes"] = notesArray;
    
    QJsonDocument doc(rootObject);
    QFile file(filePath);
    
    if (file.open(QIODevice::WriteOnly)) {
        file.write(doc.toJson());
        file.close();
        return true;
    }
    
    return false;
}

bool NoteDatabase::loadFromFile(const QString& filePath) {
    QFile file(filePath);
    
    if (file.open(QIODevice::ReadOnly)) {
        QByteArray data = file.readAll();
        file.close();
        
        QJsonDocument doc = QJsonDocument::fromJson(data);
        if (doc.isNull() || !doc.isObject()) {
            return false;
        }
        
        QJsonObject rootObject = doc.object();
        QJsonArray notesArray = rootObject["notes"].toArray();
        
        m_notes.clear();
        
        for (const QJsonValue& value : notesArray) {
            QJsonObject noteObject = value.toObject();
            
            Note note;
            note.setId(noteObject["id"].toString());
            note.setTitle(noteObject["title"].toString());
            note.setContent(noteObject["content"].toString());
            
            QDateTime createdAt = QDateTime::fromString(noteObject["createdAt"].toString(), Qt::ISODate);
            QDateTime updatedAt = QDateTime::fromString(noteObject["updatedAt"].toString(), Qt::ISODate);
            
            note.setCreatedAt(createdAt);
            note.setUpdatedAt(updatedAt);
            
            m_notes.insert(note.id(), note);
        }
        
        return true;
    }
    
    return false;
}

void NoteDatabase::parseLinks(const QString& content, QStringList& links) const {
    QRegularExpression linkRegex("\\[\\[([^\\]]+)\\]\\]");
    QRegularExpressionMatchIterator matchIterator = linkRegex.globalMatch(content);
    
    while (matchIterator.hasNext()) {
        QRegularExpressionMatch match = matchIterator.next();
        links.append(match.captured(1));
    }
}
