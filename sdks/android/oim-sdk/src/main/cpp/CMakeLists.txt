cmake_minimum_required(VERSION 3.22.1)
project("oim_native" LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
    oim_native
    SHARED
    oim_ndk_engine.cpp
)

if(ANDROID_ABI STREQUAL "arm64-v8a")
    target_compile_options(oim_native PRIVATE -O3 -march=armv8-a+crc -ffast-math -fvisibility=hidden)
else()
    target_compile_options(oim_native PRIVATE -O3 -fvisibility=hidden)
endif()

find_library(log-lib log)
find_library(jnigraphics-lib jnigraphics)
find_library(z-lib z)

target_link_libraries(
    oim_native
    ${log-lib}
    ${jnigraphics-lib}
    ${z-lib}
)
