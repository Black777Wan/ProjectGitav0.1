#ifndef MARKDOWNEDITOR_H
#define MARKDOWNEDITOR_H

#include <QTextEdit>
#include <QKeyEvent>
#include "SyntaxHighlighter.h"

class MarkdownEditor : public QTextEdit {
    Q_OBJECT

public:
    explicit MarkdownEditor(QWidget *parent = nullptr);
    ~MarkdownEditor();
    
    QString content() const;
    void setContent(const QString& text);
    
signals:
    void contentChanged();
    
protected:
    void keyPressEvent(QKeyEvent *event) override;
    
private slots:
    void onTextChanged();
    void formatBulletList();
    void increaseIndentation();
    void decreaseIndentation();
    void formatHeading(int level);
    void formatBold();
    void formatItalic();
    void formatCode();
    
private:
    SyntaxHighlighter* m_highlighter;
    bool m_isChangingByProgram;
    
    void handleTabKey();
    void handleEnterKey();
    bool isCurrentLineEmpty();
    QString getCurrentLineText();
    int getCurrentLineIndentation();
    void setCurrentLineIndentation(int spaces);
    bool isCurrentLineBullet();
};

#endif // MARKDOWNEDITOR_H
