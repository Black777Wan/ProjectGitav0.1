#include "Note.h"
#include <QUuid>

Note::Note()
    : m_id(QUuid::createUuid().toString(QUuid::WithoutBraces))
    , m_title("Untitled Note")
    , m_content("")
    , m_createdAt(QDateTime::currentDateTime())
    , m_updatedAt(QDateTime::currentDateTime())
{
}

Note::Note(const QString& id, const QString& title, const QString& content)
    : m_id(id)
    , m_title(title)
    , m_content(content)
    , m_createdAt(QDateTime::currentDateTime())
    , m_updatedAt(QDateTime::currentDateTime())
{
}

QString Note::id() const {
    return m_id;
}

void Note::setId(const QString& id) {
    m_id = id;
}

QString Note::title() const {
    return m_title;
}

void Note::setTitle(const QString& title) {
    m_title = title;
}

QString Note::content() const {
    return m_content;
}

void Note::setContent(const QString& content) {
    m_content = content;
    m_updatedAt = QDateTime::currentDateTime();
}

QDateTime Note::createdAt() const {
    return m_createdAt;
}

void Note::setCreatedAt(const QDateTime& dateTime) {
    m_createdAt = dateTime;
}

QDateTime Note::updatedAt() const {
    return m_updatedAt;
}

void Note::setUpdatedAt(const QDateTime& dateTime) {
    m_updatedAt = dateTime;
}
