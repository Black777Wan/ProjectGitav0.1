use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

// Import the shared DalError
use crate::dal_error::DalError;

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AudioRecording {
    pub id: Uuid,
    pub page_id: Option<Uuid>, // Can be NULL if audio is not associated with a page
    pub file_path: String,
    pub mime_type: Option<String>,
    pub duration_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
    // updated_at is not in the audio_recordings table schema provided
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct AudioTimestamp {
    pub id: Uuid,
    pub audio_recording_id: Uuid,
    pub block_id: Uuid,
    pub timestamp_ms: i32, // PostgreSQL INTEGER maps to i32 in Rust
    pub created_at: DateTime<Utc>,
    // updated_at is not in the audio_timestamps table schema
}

pub async fn create_audio_recording(
    pool: &PgPool,
    id: Uuid, // <<<< ADDED ID PARAMETER
    page_id: Option<Uuid>,
    file_path: &str,
    mime_type: Option<&str>,
    duration_ms: Option<i32>,
) -> Result<Uuid, DalError> { // Still returns Uuid (the one passed in)
    // LET new_id = Uuid::new_v4(); // <<<< REMOVED
    sqlx::query!(
        r#"
        INSERT INTO audio_recordings (id, page_id, file_path, mime_type, duration_ms, created_at)
        VALUES ($1, $2, $3, $4, $5, now())
        -- No RETURNING id needed if we assume the passed id is used,
        -- but to confirm insertion or for consistency:
        RETURNING id
        "#,
        id, // <<<< USE PROVIDED ID
        page_id,
        file_path,
        mime_type,
        duration_ms
    )
    .fetch_one(pool) // fetch_one to ensure it was inserted and to get the ID back (even if it's the same)
    .await?;

    Ok(id) // Return the ID that was passed in and inserted
}

pub async fn get_audio_recording(pool: &PgPool, id: Uuid) -> Result<Option<AudioRecording>, DalError> {
    let recording = sqlx::query_as!(
        AudioRecording,
        r#"
        SELECT id, page_id, file_path, mime_type, duration_ms, created_at
        FROM audio_recordings
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(recording)
}

pub async fn get_audio_recordings_for_page(
    pool: &PgPool,
    page_id: Uuid,
) -> Result<Vec<AudioRecording>, DalError> {
    let recordings = sqlx::query_as!(
        AudioRecording,
        r#"
        SELECT id, page_id, file_path, mime_type, duration_ms, created_at
        FROM audio_recordings
        WHERE page_id = $1
        ORDER BY created_at DESC
        "#,
        page_id
    )
    .fetch_all(pool)
    .await?;

    Ok(recordings)
}

// Still to implement:
// delete_audio_recording
// add_audio_timestamp_to_block
// get_audio_timestamps_for_block
// get_audio_timestamps_for_recording

pub async fn delete_audio_recording(pool: &PgPool, id: Uuid) -> Result<bool, DalError> {
    // Note: Deleting an audio recording will also delete associated audio_timestamps
    // due to ON DELETE CASCADE in the audio_timestamps table schema.
    let result = sqlx::query!(
        r#"
        DELETE FROM audio_recordings
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn add_audio_timestamp_to_block(
    pool: &PgPool,
    audio_recording_id: Uuid,
    block_id: Uuid,
    timestamp_ms: i32,
) -> Result<Uuid, DalError> {
    let new_id = Uuid::new_v4();
    let query_result = sqlx::query!(
        r#"
        INSERT INTO audio_timestamps (id, audio_recording_id, block_id, timestamp_ms, created_at)
        VALUES ($1, $2, $3, $4, now())
        RETURNING id
        "#,
        new_id,
        audio_recording_id,
        block_id,
        timestamp_ms
    )
    .fetch_one(pool)
    .await?;

    Ok(query_result.id)
}

pub async fn get_audio_timestamps_for_block(
    pool: &PgPool,
    block_id: Uuid,
) -> Result<Vec<AudioTimestamp>, DalError> {
    let timestamps = sqlx::query_as!(
        AudioTimestamp,
        r#"
        SELECT id, audio_recording_id, block_id, timestamp_ms, created_at
        FROM audio_timestamps
        WHERE block_id = $1
        ORDER BY timestamp_ms ASC
        "#,
        block_id
    )
    .fetch_all(pool)
    .await?;

    Ok(timestamps)
}

pub async fn get_audio_timestamps_for_recording(
    pool: &PgPool,
    audio_recording_id: Uuid,
) -> Result<Vec<AudioTimestamp>, DalError> {
    let timestamps = sqlx::query_as!(
        AudioTimestamp,
        r#"
        SELECT id, audio_recording_id, block_id, timestamp_ms, created_at
        FROM audio_timestamps
        WHERE audio_recording_id = $1
        ORDER BY timestamp_ms ASC
        "#,
        audio_recording_id
    )
    .fetch_all(pool)
    .await?;

    Ok(timestamps)
}
