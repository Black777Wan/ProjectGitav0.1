#include "PageList.h"
#include <QDateTime>
#include <QIcon>

PageList::PageList(QWidget *parent)
    : QListWidget(parent)
{
    // Set up appearance
    setFrameShape(QFrame::NoFrame);
    setSelectionMode(QAbstractItemView::SingleSelection);
    
    // Connect signals
    connect(this, &QListWidget::itemClicked, this, &PageList::onItemClicked);
}

PageList::~PageList() {
}

void PageList::setNotes(const QList<Note>& notes) {
    // Clear existing items
    clear();
    m_itemToNoteId.clear();
    
    // Add notes to the list
    for (const Note& note : notes) {
        QListWidgetItem* item = new QListWidgetItem(note.title());
        
        // Set tooltip to show creation date
        QString tooltip = QString("Created: %1\nLast modified: %2")
                         .arg(note.createdAt().toString("yyyy-MM-dd hh:mm"))
                         .arg(note.updatedAt().toString("yyyy-MM-dd hh:mm"));
        item->setToolTip(tooltip);
        
        // Store note ID for lookup
        m_itemToNoteId[item] = note.id();
        
        // Add to list
        addItem(item);
    }
    
    // Sort alphabetically
    sortItems();
}

void PageList::onItemClicked(QListWidgetItem* item) {
    if (item && m_itemToNoteId.contains(item)) {
        QString noteId = m_itemToNoteId[item];
        emit noteSelected(noteId);
    }
}
