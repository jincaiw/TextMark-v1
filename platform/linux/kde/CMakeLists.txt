cmake_minimum_required(VERSION 3.25)
project(TextMarkThumbnailCreator VERSION 0.3.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(ECM 6.0 REQUIRED NO_MODULE)
list(APPEND CMAKE_MODULE_PATH ${ECM_MODULE_PATH})
include(KDEInstallDirs6)
include(KDECMakeSettings)
include(KDECompilerSettings NO_POLICY_SCOPE)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui)
find_package(KF6 6.0 REQUIRED COMPONENTS CoreAddons KIO)

kcoreaddons_add_plugin(textmarkthumbnail
  SOURCES TextMarkThumbnailPlugin.cpp TextMarkThumbnailCreator.cpp
  INSTALL_NAMESPACE "kf6/thumbcreator"
)
target_link_libraries(textmarkthumbnail PRIVATE Qt6::Core Qt6::Gui KF6::CoreAddons KF6::KIOGui)
target_compile_options(textmarkthumbnail PRIVATE -Wall -Wextra -Wpedantic -Werror)

include(CTest)
if(BUILD_TESTING)
  add_executable(textmark-thumbnail-fake tests/FakeThumbnailer.cpp)
  target_link_libraries(textmark-thumbnail-fake PRIVATE Qt6::Core Qt6::Gui)
  target_compile_options(textmark-thumbnail-fake PRIVATE -Wall -Wextra -Wpedantic -Werror)

  add_executable(textmark-thumbnail-test tests/ThumbnailCreatorTest.cpp TextMarkThumbnailCreator.cpp)
  target_include_directories(textmark-thumbnail-test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
  target_link_libraries(textmark-thumbnail-test PRIVATE Qt6::Core Qt6::Gui KF6::KIOGui)
  target_compile_options(textmark-thumbnail-test PRIVATE -Wall -Wextra -Wpedantic -Werror)
  add_test(NAME TextMarkThumbnailCreator COMMAND textmark-thumbnail-test $<TARGET_FILE:textmark-thumbnail-fake>)
endif()
