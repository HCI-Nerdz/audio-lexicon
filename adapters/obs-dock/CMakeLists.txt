cmake_minimum_required(VERSION 3.22)
project(audio-lexicon-obs VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)

option(ENABLE_FRONTEND_API "OBS frontend API" ON)
option(ENABLE_QT "Qt UI" ON)

# Standalone scaffold: builds a shared library when OBS SDK is present.
# Without OBS, builds a dry-run static check target documenting the dock.

find_package(Qt6 COMPONENTS Widgets QUIET)
find_package(libobs QUIET)
find_package(obs-frontend-api QUIET)

add_library(audio-lexicon-obs MODULE
  src/plugin-main.cpp
  src/lexicon-dock.cpp
  src/lexicon-dock.hpp
)

target_compile_definitions(audio-lexicon-obs PRIVATE
  PLUGIN_NAME="audio-lexicon-obs"
  PLUGIN_VERSION="${PROJECT_VERSION}"
  NOT_FOR_OBS_UPSTREAM=1
)

if(Qt6_FOUND)
  target_link_libraries(audio-lexicon-obs PRIVATE Qt6::Widgets)
  target_compile_definitions(audio-lexicon-obs PRIVATE HAS_QT=1)
endif()

if(libobs_FOUND AND obs-frontend-api_FOUND)
  target_link_libraries(audio-lexicon-obs PRIVATE OBS::libobs OBS::frontend-api)
  target_compile_definitions(audio-lexicon-obs PRIVATE HAS_OBS=1)
else()
  message(WARNING "OBS SDK not found — compiling dock UI stubs only (HAS_OBS=0)")
endif()
