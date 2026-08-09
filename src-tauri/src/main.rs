// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if textmark_lib::run_cli_mode() {
        return;
    }
    textmark_lib::run()
}
