use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[POS] Inicio de la app Tauri");
    println!("[SQLite] Base solicitada: sqlite:charly-alexa-pos.db");
    println!("[SQLite] Migraciones configuradas: 001_initial.sql");

    let migrations = vec![Migration {
        version: 1,
        description: "initial_pos_schema",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    println!("[SQLite] Plugin SQL registrado");

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:charly-alexa-pos.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Charly Alexa POS");
}
