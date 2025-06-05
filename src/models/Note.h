#ifndef NOTE_H
#define NOTE_H

#include <QString>
#include <QDateTime>

class Note {
public:
    Note();
    Note(const QString& id, const QString& title, const QString& content);
    
    QString id() const;
    void setId(const QString& id);
    
    QString title() const;
    void setTitle(const QString& title);
    
    QString content() const;
    void setContent(const QString& content);
    
    QDateTime createdAt() const;
    void setCreatedAt(const QDateTime& dateTime);
    
    QDateTime updatedAt() const;
    void setUpdatedAt(const QDateTime& dateTime);
    
private:
    QString m_id;
    QString m_title;
    QString m_content;
    QDateTime m_createdAt;
    QDateTime m_updatedAt;
};

#endif // NOTE_H
