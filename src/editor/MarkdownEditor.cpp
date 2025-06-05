#include "MarkdownEditor.h"
#include <QTextBlock>
#include <QTextCursor>
#include <QDebug>
#include <QRegularExpression>

MarkdownEditor::MarkdownEditor(QWidget *parent)
    : QTextEdit(parent)
    , m_isChangingByProgram(false)
{
    // Apply custom font
    QFont font("Consolas", 11);
    setFont(font);
    
    // Set document margins
    document()->setDocumentMargin(20);
    
    // Create and apply syntax highlighter
    m_highlighter = new SyntaxHighlighter(document());
    
    // Connect signals
    connect(this, &QTextEdit::textChanged, this, &MarkdownEditor::onTextChanged);
    
    // Set placeholder text
    setPlaceholderText("Start writing...");
}

MarkdownEditor::~MarkdownEditor() {
}

QString MarkdownEditor::content() const {
    return toPlainText();
}

void MarkdownEditor::setContent(const QString& text) {
    m_isChangingByProgram = true;
    setPlainText(text);
    m_isChangingByProgram = false;
}

void MarkdownEditor::keyPressEvent(QKeyEvent *event) {
    if (event->key() == Qt::Key_Tab) {
        handleTabKey();
        event->accept();
    } else if (event->key() == Qt::Key_Backtab) {
        decreaseIndentation();
        event->accept();
    } else if (event->key() == Qt::Key_Return || event->key() == Qt::Key_Enter) {
        handleEnterKey();
        event->accept();
    } else {
        QTextEdit::keyPressEvent(event);
    }
}

void MarkdownEditor::onTextChanged() {
    if (!m_isChangingByProgram) {
        emit contentChanged();
    }
}

void MarkdownEditor::handleTabKey() {
    if (textCursor().hasSelection()) {
        // Increase indentation for multiple selected lines
        increaseIndentation();
    } else {
        // Insert 4 spaces at cursor position
        textCursor().insertText("    ");
    }
}

void MarkdownEditor::handleEnterKey() {
    QString currentLine = getCurrentLineText();
    int indentation = getCurrentLineIndentation();
    bool isBullet = isCurrentLineBullet();
    
    // Insert new line
    QTextCursor cursor = textCursor();
    cursor.insertText("\n");
    
    // If current line is a bullet point and not empty, add a new bullet point
    if (isBullet) {
        // Extract bullet character from current line
        QRegularExpression bulletRegex("^(\\s*)([-*+])\\s+(.*)$");
        QRegularExpressionMatch match = bulletRegex.match(currentLine);
        
        if (match.hasMatch()) {
            QString spaces = match.captured(1);
            QString bulletChar = match.captured(2);
            QString lineContent = match.captured(3);
            
            // If the line is empty (just a bullet), remove the bullet and return
            if (lineContent.trimmed().isEmpty()) {
                // Remove the previous line
                cursor.movePosition(QTextCursor::Up);
                cursor.select(QTextCursor::LineUnderCursor);
                cursor.removeSelectedText();
                cursor.deleteChar(); // Remove the newline
                return;
            }
            
            // Otherwise add a new bullet at the same indentation level
            cursor.insertText(spaces + bulletChar + " ");
        }
    } else if (indentation > 0) {
        // If the line has indentation but is not a bullet, preserve indentation
        cursor.insertText(QString(" ").repeated(indentation));
    }
}

bool MarkdownEditor::isCurrentLineEmpty() {
    QString text = getCurrentLineText().trimmed();
    // Check if line is empty or just contains a bullet point
    return text.isEmpty() || text.startsWith("-") || text.startsWith("*") || text.startsWith("+");
}

QString MarkdownEditor::getCurrentLineText() {
    QTextCursor cursor = textCursor();
    cursor.movePosition(QTextCursor::StartOfLine);
    cursor.movePosition(QTextCursor::EndOfLine, QTextCursor::KeepAnchor);
    return cursor.selectedText();
}

int MarkdownEditor::getCurrentLineIndentation() {
    QString lineText = getCurrentLineText();
    int spaceCount = 0;
    
    for (QChar c : lineText) {
        if (c == ' ') {
            spaceCount++;
        } else {
            break;
        }
    }
    
    return spaceCount;
}

void MarkdownEditor::setCurrentLineIndentation(int spaces) {
    QTextCursor cursor = textCursor();
    cursor.movePosition(QTextCursor::StartOfLine);
    
    // Remove existing indentation
    int currentIndent = getCurrentLineIndentation();
    for (int i = 0; i < currentIndent; i++) {
        cursor.deleteChar();
    }
    
    // Add new indentation
    if (spaces > 0) {
        cursor.insertText(QString(" ").repeated(spaces));
    }
}

bool MarkdownEditor::isCurrentLineBullet() {
    QString line = getCurrentLineText().trimmed();
    return line.startsWith("-") || line.startsWith("*") || line.startsWith("+");
}

void MarkdownEditor::formatBulletList() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        // Format each selected line as a bullet point
        QTextBlock block = document()->findBlock(cursor.selectionStart());
        QTextBlock end = document()->findBlock(cursor.selectionEnd());
        
        m_isChangingByProgram = true;
        
        do {
            cursor.setPosition(block.position());
            cursor.movePosition(QTextCursor::StartOfLine);
            
            // Check if line already has a bullet
            QString lineText = block.text();
            QRegularExpression bulletRegex("^\\s*[-*+]\\s+");
            
            if (!bulletRegex.match(lineText).hasMatch()) {
                // Add bullet to the beginning of line (preserving indentation)
                int indent = 0;
                for (QChar c : lineText) {
                    if (c == ' ') indent++;
                    else break;
                }
                
                cursor.movePosition(QTextCursor::Right, QTextCursor::MoveAnchor, indent);
                
                // Delete existing indentation
                cursor.movePosition(QTextCursor::StartOfLine);
                for (int i = 0; i < indent; i++) {
                    cursor.deleteChar();
                }
                
                // Add indentation and bullet
                cursor.insertText(QString(" ").repeated(indent) + "- ");
            }
            
            block = block.next();
        } while (block.isValid() && block <= end);
        
        m_isChangingByProgram = false;
        emit contentChanged();
    } else {
        // Format current line as a bullet point
        cursor.movePosition(QTextCursor::StartOfLine);
        
        QString lineText = getCurrentLineText();
        QRegularExpression bulletRegex("^\\s*[-*+]\\s+");
        
        if (!bulletRegex.match(lineText).hasMatch()) {
            int indent = getCurrentLineIndentation();
            
            m_isChangingByProgram = true;
            
            // Delete existing indentation
            cursor.movePosition(QTextCursor::StartOfLine);
            for (int i = 0; i < indent; i++) {
                cursor.deleteChar();
            }
            
            // Add indentation and bullet
            cursor.insertText(QString(" ").repeated(indent) + "- ");
            
            m_isChangingByProgram = false;
            emit contentChanged();
        }
    }
}

void MarkdownEditor::increaseIndentation() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        // Increase indentation for each selected line
        QTextBlock block = document()->findBlock(cursor.selectionStart());
        QTextBlock end = document()->findBlock(cursor.selectionEnd());
        
        m_isChangingByProgram = true;
        
        do {
            cursor.setPosition(block.position());
            cursor.movePosition(QTextCursor::StartOfLine);
            cursor.insertText("    ");
            block = block.next();
        } while (block.isValid() && block <= end);
        
        m_isChangingByProgram = false;
        emit contentChanged();
    } else {
        // Increase indentation for current line
        cursor.movePosition(QTextCursor::StartOfLine);
        cursor.insertText("    ");
    }
}

void MarkdownEditor::decreaseIndentation() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        // Decrease indentation for each selected line
        QTextBlock block = document()->findBlock(cursor.selectionStart());
        QTextBlock end = document()->findBlock(cursor.selectionEnd());
        
        m_isChangingByProgram = true;
        
        do {
            QString text = block.text();
            cursor.setPosition(block.position());
            
            // Remove up to 4 spaces from the beginning of the line
            int spacesToRemove = 0;
            for (int i = 0; i < qMin(4, text.length()); i++) {
                if (text[i] == ' ') {
                    spacesToRemove++;
                } else {
                    break;
                }
            }
            
            for (int i = 0; i < spacesToRemove; i++) {
                cursor.deleteChar();
            }
            
            block = block.next();
        } while (block.isValid() && block <= end);
        
        m_isChangingByProgram = false;
        emit contentChanged();
    } else {
        // Decrease indentation for current line
        QString lineText = getCurrentLineText();
        int spacesToRemove = qMin(4, getCurrentLineIndentation());
        
        if (spacesToRemove > 0) {
            cursor.movePosition(QTextCursor::StartOfLine);
            for (int i = 0; i < spacesToRemove; i++) {
                cursor.deleteChar();
            }
        }
    }
}

void MarkdownEditor::formatHeading(int level) {
    QTextCursor cursor = textCursor();
    cursor.movePosition(QTextCursor::StartOfLine);
    
    QString lineText = getCurrentLineText().trimmed();
    QRegularExpression headingRegex("^#+\\s+");
    QRegularExpressionMatch match = headingRegex.match(lineText);
    
    m_isChangingByProgram = true;
    
    if (match.hasMatch()) {
        // Replace existing heading
        cursor.movePosition(QTextCursor::StartOfLine);
        cursor.movePosition(QTextCursor::EndOfLine, QTextCursor::KeepAnchor);
        cursor.removeSelectedText();
        
        QString headingText = lineText.mid(match.capturedLength());
        cursor.insertText(QString("#").repeated(level) + " " + headingText);
    } else {
        // Add new heading
        cursor.movePosition(QTextCursor::StartOfLine);
        cursor.movePosition(QTextCursor::EndOfLine, QTextCursor::KeepAnchor);
        cursor.removeSelectedText();
        cursor.insertText(QString("#").repeated(level) + " " + lineText);
    }
    
    m_isChangingByProgram = false;
    emit contentChanged();
}

void MarkdownEditor::formatBold() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        QString selectedText = cursor.selectedText();
        cursor.removeSelectedText();
        cursor.insertText("**" + selectedText + "**");
    } else {
        cursor.insertText("****");
        cursor.movePosition(QTextCursor::Left, QTextCursor::MoveAnchor, 2);
    }
}

void MarkdownEditor::formatItalic() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        QString selectedText = cursor.selectedText();
        cursor.removeSelectedText();
        cursor.insertText("*" + selectedText + "*");
    } else {
        cursor.insertText("**");
        cursor.movePosition(QTextCursor::Left, QTextCursor::MoveAnchor, 1);
    }
}

void MarkdownEditor::formatCode() {
    QTextCursor cursor = textCursor();
    
    if (cursor.hasSelection()) {
        QString selectedText = cursor.selectedText();
        cursor.removeSelectedText();
        cursor.insertText("`" + selectedText + "`");
    } else {
        cursor.insertText("``");
        cursor.movePosition(QTextCursor::Left, QTextCursor::MoveAnchor, 1);
    }
}
