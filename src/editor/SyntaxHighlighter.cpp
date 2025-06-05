#include "SyntaxHighlighter.h"

SyntaxHighlighter::SyntaxHighlighter(QTextDocument *parent)
    : QSyntaxHighlighter(parent)
{
    // Format for headings
    m_headingFormat.setFontWeight(QFont::Bold);
    m_headingFormat.setForeground(QColor("#1a202c"));
    m_headingFormat.setFontPointSize(16);
    
    // Format for bold text
    m_boldFormat.setFontWeight(QFont::Bold);
    m_boldFormat.setForeground(QColor("#1a202c"));
    
    // Format for italic text
    m_italicFormat.setFontItalic(true);
    
    // Format for bullet points
    m_bulletFormat.setForeground(QColor("#4a5568"));
    m_bulletFormat.setFontWeight(QFont::Bold);
    
    // Format for code
    m_codeFormat.setFontFamily("Consolas");
    m_codeFormat.setBackground(QColor("#f7fafc"));
    m_codeFormat.setForeground(QColor("#2d3748"));
    
    // Format for links
    m_linkFormat.setForeground(QColor("#3182ce"));
    m_linkFormat.setUnderlineStyle(QTextCharFormat::SingleUnderline);
    
    // Format for block quotes
    m_quoteFormat.setForeground(QColor("#4a5568"));
    m_quoteFormat.setFontItalic(true);
    
    // Heading rule (# Heading)
    HighlightingRule rule;
    rule.pattern = QRegularExpression("^#\\s+.+$");
    rule.format = m_headingFormat;
    m_highlightingRules.append(rule);
    
    // Heading level 2 (## Heading)
    rule.pattern = QRegularExpression("^##\\s+.+$");
    rule.format = m_headingFormat;
    rule.format.setFontPointSize(14);
    m_highlightingRules.append(rule);
    
    // Heading level 3 (### Heading)
    rule.pattern = QRegularExpression("^###\\s+.+$");
    rule.format = m_headingFormat;
    rule.format.setFontPointSize(12);
    m_highlightingRules.append(rule);
    
    // Bold text (**bold**)
    rule.pattern = QRegularExpression("\\*\\*(.+?)\\*\\*");
    rule.format = m_boldFormat;
    m_highlightingRules.append(rule);
    
    // Italic text (*italic*)
    rule.pattern = QRegularExpression("\\*(.+?)\\*");
    rule.format = m_italicFormat;
    m_highlightingRules.append(rule);
    
    // Bullet points
    rule.pattern = QRegularExpression("^\\s*[-*+]\\s+");
    rule.format = m_bulletFormat;
    m_highlightingRules.append(rule);
    
    // Inline code (`code`)
    rule.pattern = QRegularExpression("`([^`]+)`");
    rule.format = m_codeFormat;
    m_highlightingRules.append(rule);
    
    // Links ([text](url))
    rule.pattern = QRegularExpression("\\[([^\\[\\]]+)\\]\\(([^\\(\\)]+)\\)");
    rule.format = m_linkFormat;
    m_highlightingRules.append(rule);
    
    // Wiki-style links ([[link]])
    rule.pattern = QRegularExpression("\\[\\[([^\\[\\]]+)\\]\\]");
    rule.format = m_linkFormat;
    m_highlightingRules.append(rule);
    
    // Block quotes
    rule.pattern = QRegularExpression("^>\\s+.+$");
    rule.format = m_quoteFormat;
    m_highlightingRules.append(rule);
}

void SyntaxHighlighter::highlightBlock(const QString &text) {
    for (const HighlightingRule &rule : qAsConst(m_highlightingRules)) {
        QRegularExpressionMatchIterator matchIterator = rule.pattern.globalMatch(text);
        while (matchIterator.hasNext()) {
            QRegularExpressionMatch match = matchIterator.next();
            setFormat(match.capturedStart(), match.capturedLength(), rule.format);
        }
    }
}
