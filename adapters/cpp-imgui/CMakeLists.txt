cmake_minimum_required(VERSION 3.21)
project(audio-lexicon-imgui VERSION 0.1.0 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)

option(AUDIO_LEXICON_IMGUI_FETCH "Fetch GLFW + Dear ImGui" ON)

if(AUDIO_LEXICON_IMGUI_FETCH)
  include(FetchContent)
  FetchContent_Declare(glfw GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4)
  set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
  set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
  set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  FetchContent_Declare(imgui GIT_REPOSITORY https://github.com/ocornut/imgui.git GIT_TAG v1.91.8)
  FetchContent_MakeAvailable(glfw imgui)
endif()

add_executable(audio-lexicon-imgui
  src/main.cpp
  ${imgui_SOURCE_DIR}/imgui.cpp
  ${imgui_SOURCE_DIR}/imgui_draw.cpp
  ${imgui_SOURCE_DIR}/imgui_tables.cpp
  ${imgui_SOURCE_DIR}/imgui_widgets.cpp
  ${imgui_SOURCE_DIR}/backends/imgui_impl_glfw.cpp
  ${imgui_SOURCE_DIR}/backends/imgui_impl_opengl3.cpp
)
target_include_directories(audio-lexicon-imgui PRIVATE
  ${imgui_SOURCE_DIR}
  ${imgui_SOURCE_DIR}/backends
)
target_link_libraries(audio-lexicon-imgui PRIVATE glfw)
if(APPLE)
  target_link_libraries(audio-lexicon-imgui PRIVATE "-framework OpenGL")
elseif(WIN32)
  target_link_libraries(audio-lexicon-imgui PRIVATE opengl32)
else()
  target_link_libraries(audio-lexicon-imgui PRIVATE GL)
endif()
target_compile_definitions(audio-lexicon-imgui PRIVATE APP_VERSION="${PROJECT_VERSION}")
