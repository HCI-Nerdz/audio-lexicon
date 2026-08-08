cmake_minimum_required(VERSION 3.21)
project(audio-lexicon-qt VERSION 0.1.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
find_package(Qt6 REQUIRED COMPONENTS Widgets)
add_executable(audio-lexicon-qt
  src/main.cpp
  src/MainWindow.cpp
  src/MainWindow.hpp
)
target_link_libraries(audio-lexicon-qt PRIVATE Qt6::Widgets)
target_compile_definitions(audio-lexicon-qt PRIVATE APP_VERSION="${PROJECT_VERSION}")
