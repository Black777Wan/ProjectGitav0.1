cmake_minimum_required(VERSION 3.15)
project(YD-Notes-CPP VERSION 0.1 LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 COMPONENTS Widgets REQUIRED)

add_executable(${PROJECT_NAME}
    src/main.cpp
    src/MainWindow.cpp
    src/editor/MarkdownEditor.cpp
    src/editor/SyntaxHighlighter.cpp
    src/models/Note.cpp
    src/models/NoteDatabase.cpp
    src/widgets/PageList.cpp
    src/widgets/NavigationPanel.cpp
)

target_link_libraries(${PROJECT_NAME} PRIVATE Qt6::Widgets)

# Copy resources
file(COPY ${CMAKE_SOURCE_DIR}/resources DESTINATION ${CMAKE_BINARY_DIR})
