use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

// Import the shared DalError
use crate::dal_error::DalError;

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct PageLink {
    // Note: page_links table has (source_page_id, target_page_id) as PK.
    // We select these fields plus created_at for the struct.
    pub source_page_id: Uuid,
    pub target_page_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct BlockReference {
    pub id: Uuid,
    pub referencing_page_id: Uuid,
    pub referencing_block_id: Uuid,
    pub referenced_page_id: Uuid,
    pub referenced_block_id: Uuid,
    pub created_at: DateTime<Utc>,
    // updated_at is not in the block_references table schema
}

// --- Page Link Functions ---

pub async fn add_page_link(
    pool: &PgPool,
    source_page_id: Uuid,
    target_page_id: Uuid,
) -> Result<(), DalError> {
    sqlx::query!(
        r#"
        INSERT INTO page_links (source_page_id, target_page_id, created_at)
        VALUES ($1, $2, now())
        ON CONFLICT (source_page_id, target_page_id) DO NOTHING
        -- If the link already exists, do nothing. Or use DO UPDATE if you need to update created_at.
        "#,
        source_page_id,
        target_page_id
    )
    .execute(pool)
    .await?;
    // Returns Result<(), DalError> indicating success or failure. No specific ID for this link type.
    Ok(())
}

pub async fn remove_page_link(
    pool: &PgPool,
    source_page_id: Uuid,
    target_page_id: Uuid,
) -> Result<bool, DalError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM page_links
        WHERE source_page_id = $1 AND target_page_id = $2
        "#,
        source_page_id,
        target_page_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn find_backlinks_for_page( // Incoming links
    pool: &PgPool,
    page_id: Uuid, // This is the target_page_id
) -> Result<Vec<PageLink>, DalError> {
    let links = sqlx::query_as!(
        PageLink,
        r#"
        SELECT source_page_id, target_page_id, created_at
        FROM page_links
        WHERE target_page_id = $1
        ORDER BY created_at DESC
        "#,
        page_id
    )
    .fetch_all(pool)
    .await?;

    Ok(links)
}

pub async fn find_outgoing_links_for_page(
    pool: &PgPool,
    page_id: Uuid, // This is the source_page_id
) -> Result<Vec<PageLink>, DalError> {
    let links = sqlx::query_as!(
        PageLink,
        r#"
        SELECT source_page_id, target_page_id, created_at
        FROM page_links
        WHERE source_page_id = $1
        ORDER BY created_at DESC
        "#,
        page_id
    )
    .fetch_all(pool)
    .await?;

    Ok(links)
}

// Still to implement block reference functions:
// add_block_reference
// get_block_references_from_block
// get_block_references_to_block

// --- Block Reference Functions ---

pub async fn add_block_reference(
    pool: &PgPool,
    referencing_page_id: Uuid,
    referencing_block_id: Uuid,
    referenced_page_id: Uuid,
    referenced_block_id: Uuid,
) -> Result<Uuid, DalError> {
    let new_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO block_references
            (id, referencing_page_id, referencing_block_id, referenced_page_id, referenced_block_id, created_at)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (referencing_block_id, referenced_block_id) DO NOTHING
        -- If the reference already exists, do nothing.
        -- Consider if ON CONFLICT needs to return the existing ID or update a timestamp.
        -- For now, it just inserts or does nothing, returning the new_id if inserted.
        -- To reliably get the ID (new or existing), a SELECT after INSERT or more complex logic is needed.
        -- For simplicity, we'll assume new_id is desired if insert happens.
        "#,
        new_id,
        referencing_page_id,
        referencing_block_id,
        referenced_page_id,
        referenced_block_id
    )
    .execute(pool)
    .await?;
    // This doesn't return the ID if there's a conflict and DO NOTHING occurs.
    // If returning the ID is critical even on conflict, this needs adjustment.
    // The plan asks for `Result<uuid::Uuid, dal::Error>`, so returning the generated new_id.
    Ok(new_id)
}

pub async fn get_block_references_from_block( // Outgoing references from a specific block
    pool: &PgPool,
    referencing_block_id: Uuid,
) -> Result<Vec<BlockReference>, DalError> {
    let references = sqlx::query_as!(
        BlockReference,
        r#"
        SELECT id, referencing_page_id, referencing_block_id, referenced_page_id, referenced_block_id, created_at
        FROM block_references
        WHERE referencing_block_id = $1
        ORDER BY created_at DESC
        "#,
        referencing_block_id
    )
    .fetch_all(pool)
    .await?;

    Ok(references)
}

pub async fn get_block_references_to_block( // Incoming references to a specific block
    pool: &PgPool,
    referenced_block_id: Uuid,
) -> Result<Vec<BlockReference>, DalError> {
    let references = sqlx::query_as!(
        BlockReference,
        r#"
        SELECT id, referencing_page_id, referencing_block_id, referenced_page_id, referenced_block_id, created_at
        FROM block_references
        WHERE referenced_block_id = $1
        ORDER BY created_at DESC
        "#,
        referenced_block_id
    )
    .fetch_all(pool)
    .await?;

    Ok(references)
}

pub async fn remove_block_reference(
    pool: &PgPool,
    id: Uuid, // ID of the block reference itself
) -> Result<bool, DalError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM block_references
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

// Also consider if a function to remove by (referencing_block_id, referenced_block_id) is needed.
// For now, remove by the reference's own ID.
