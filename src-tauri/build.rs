fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let manifest_dir = std::path::PathBuf::from(
            std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo must provide CARGO_MANIFEST_DIR"),
        );
        std::fs::create_dir_all(manifest_dir.join("../platform/windows/build/package"))
            .expect("failed to prepare the generated Windows preview resource directory");
    }
    tauri_build::build()
}
