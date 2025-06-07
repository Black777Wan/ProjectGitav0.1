use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

// Import the shared DalError
use crate::dal_error::DalError;

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Block {
    pub id: Uuid,
    pub page_id: Uuid,
    pub parent_block_id: Option<Uuid>,
    pub block_type: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn create_block(
    pool: &PgPool,
    id: Uuid, // Accept the ID from content_json
    page_id: Uuid,
    parent_block_id: Option<Uuid>,
    block_type: Option<&str>,
) -> Result<Uuid, DalError> {
    // The 'id' is now provided, not generated.
    sqlx::query!(
        r#"
        INSERT INTO blocks (id, page_id, parent_block_id, block_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        ON CONFLICT (id) DO NOTHING
        -- If a block with this ID somehow already exists (e.g. from a previous failed sync or different page),
        -- DO NOTHING to prevent error. Or, consider DO UPDATE if attributes might change.
        -- For now, DO NOTHING is safer if IDs are globally unique and shouldn't be re-inserted.
        -- If IDs are only unique per page, then ON CONFLICT (id, page_id) might be better.
        -- However, block IDs from Lexical are expected to be unique.
        "#,
        id, // Use the provided id
        page_id,
        parent_block_id,
        block_type
    )
    .execute(pool) // Use execute instead of fetch_one as ON CONFLICT DO NOTHING might not return a row
    .await?;

    Ok(id) // Return the provided id
}

pub async fn get_block(pool: &PgPool, id: Uuid) -> Result<Option<Block>, DalError> {
    let block = sqlx::query_as!(
        Block,
        r#"
        SELECT id, page_id, parent_block_id, block_type, created_at, updated_at
        FROM blocks
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(block)
}

pub async fn get_blocks_for_page(pool: &PgPool, page_id: Uuid) -> Result<Vec<Block>, DalError> {
    let blocks = sqlx::query_as!(
        Block,
        r#"
        SELECT id, page_id, parent_block_id, block_type, created_at, updated_at
        FROM blocks
        WHERE page_id = $1
        ORDER BY created_at ASC -- Or some other meaningful order
        "#,
        page_id
    )
    .fetch_all(pool)
    .await?;

    Ok(blocks)
}

// Still to implement:
// update_block
// delete_block

pub async fn update_block(
    pool: &PgPool,
    id: Uuid,
    // page_id cannot be updated, it's fixed once created.
    parent_block_id: Option<Option<Uuid>>, // Option<Option<T>>: Outer=update?, Inner=value (Some(val) or None for NULL)
    block_type: Option<Option<String>>,    // Option<Option<T>>: Outer=update?, Inner=value (Some(val) or None for NULL)
) -> Result<bool, DalError> {
    let mut set_clauses = Vec::new();
    let mut params_count = 1; // Start with $1 for id

    if parent_block_id.is_some() {
        params_count += 1;
        set_clauses.push(format!("parent_block_id = ${}", params_count));
    }
    if block_type.is_some() {
        params_count += 1;
        set_clauses.push(format!("block_type = ${}", params_count));
    }

    if set_clauses.is_empty() {
        return Ok(false); // No fields to update
    }

    set_clauses.push("updated_at = now()"); // Always update updated_at

    let query_str = format!(
        "UPDATE blocks SET {} WHERE id = $1 RETURNING id", // RETURNING id to check if row was found
        set_clauses.join(", ")
    );

    let mut query = sqlx::query(&query_str);
    query = query.bind(id);

    if let Some(pbi) = parent_block_id {
        query = query.bind(pbi); // pbi is Option<Uuid> directly
    }
    if let Some(bt) = block_type {
        query = query.bind(bt); // bt is Option<String> directly
    }

    let result = query.execute(pool).await?;
    Ok(result.rows_affected() > 0)
}

pub async fn get_page_id_for_block(pool: &PgPool, block_id: Uuid) -> Result<Option<Uuid>, DalError> {
    let result = sqlx::query!(
        r#"
        SELECT page_id
        FROM blocks
        WHERE id = $1
        "#,
        block_id
    )
    .fetch_optional(pool)
    .await?;

    // query! returns a record-like struct, so access page_id field, then map to Option<Uuid>
    Ok(result.map(|row| row.page_id))
}

pub async fn delete_block(pool: &PgPool, id: Uuid) -> Result<bool, DalError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM blocks
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
