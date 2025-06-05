#include "MainWindow.h"
#include <QApplication>
#include <QFile>
#include <QDir>
#include <QStandardPaths>
#include <QMessageBox>

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    
    // Set application information
    QCoreApplication::setOrganizationName("YD-Notes");
    QCoreApplication::setApplicationName("YD-Notes-CPP");
    QCoreApplication::setApplicationVersion("0.1.0");
    
    // Apply stylesheet if available
    QFile styleFile("resources/styles.qss");
    if (styleFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        app.setStyleSheet(styleFile.readAll());
        styleFile.close();
    }
    
    // Create data directory if it doesn't exist
    QDir dataDir(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation));
    if (!dataDir.exists()) {
        dataDir.mkpath(".");
    }
    
    // Create main window
    MainWindow mainWindow;
    mainWindow.show();
    
    return app.exec();
}
