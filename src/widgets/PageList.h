#ifndef PAGELIST_H
#define PAGELIST_H

#include <QListWidget>
#include <QList>
#include "../models/Note.h"

class PageList : public QListWidget {
    Q_OBJECT

public:
    explicit PageList(QWidget *parent = nullptr);
    ~PageList();
    
    void setNotes(const QList<Note>& notes);
    
signals:
    void noteSelected(const QString& noteId);
    
private slots:
    void onItemClicked(QListWidgetItem* item);
    
private:
    QMap<QListWidgetItem*, QString> m_itemToNoteId;
};

#endif // PAGELIST_H
