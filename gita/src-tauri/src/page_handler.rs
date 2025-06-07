use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

// Import the shared DalError
use crate::dal_error::DalError;

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct Page {
    pub id: Uuid,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub content_json: Value,
    pub raw_markdown: Option<String>,
}

pub async fn create_page(
    pool: &PgPool,
    title: &str,
    content_json: Value,
    raw_markdown: Option<&str>,
) -> Result<Uuid, DalError> {
    let new_id = Uuid::new_v4();
    let query_result = sqlx::query!(
        r#"
        INSERT INTO pages (id, title, content_json, raw_markdown, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        RETURNING id
        "#,
        new_id,
        title,
        content_json,
        raw_markdown
    )
    .fetch_one(pool)
    .await?;

    Ok(query_result.id)
}

pub async fn get_page(pool: &PgPool, id: Uuid) -> Result<Option<Page>, DalError> {
    let page = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(page)
}

pub async fn list_pages(pool: &PgPool) -> Result<Vec<Page>, DalError> {
    let pages = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        ORDER BY updated_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(pages)
}

// Still to implement:
// update_page
// delete_page
// search_pages

pub async fn update_page(
    pool: &PgPool,
    id: Uuid,
    title: Option<&str>,
    content_json: Option<Value>,
    raw_markdown: Option<Option<&str>>, // Option<Option<T>> to distinguish between no-update and set-to-NULL
) -> Result<bool, DalError> {
    // Build the query dynamically based on which fields are provided
    let mut set_clauses = Vec::new();
    let mut params_count = 1; // Start with $1 for id

    if title.is_some() {
        params_count += 1;
        set_clauses.push(format!("title = ${}", params_count));
    }
    if content_json.is_some() {
        params_count += 1;
        set_clauses.push(format!("content_json = ${}", params_count));
    }
    if raw_markdown.is_some() { // This means an update to raw_markdown is requested
        params_count += 1;
        set_clauses.push(format!("raw_markdown = ${}", params_count));
    }

    if set_clauses.is_empty() {
        // No fields to update
        return Ok(false);
    }

    // Always update the updated_at timestamp
    set_clauses.push(format!("updated_at = now()"));

    let query_str = format!(
        "UPDATE pages SET {} WHERE id = $1 RETURNING id",
        set_clauses.join(", ")
    );

    let mut query = sqlx::query(&query_str);
    query = query.bind(id);

    if let Some(t) = title {
        query = query.bind(t);
    }
    if let Some(c) = content_json {
        query = query.bind(c);
    }
    if let Some(rm) = raw_markdown { // This outer Option means "is an update for raw_markdown intended?"
        match rm { // This inner Option means "what should the value be?"
            Some(val) => query = query.bind(val), // Set to new value
            None => query = query.bind(Option::<&str>::None), // Set to NULL explicitly
        }
    }

    let result = query.execute(pool).await?;
    Ok(result.rows_affected() > 0)
}

pub async fn delete_page(pool: &PgPool, id: Uuid) -> Result<bool, DalError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM pages
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn search_pages(pool: &PgPool, query_term: &str) -> Result<Vec<Page>, DalError> {
    let search_pattern = format!("%{}%", query_term);

    let pages = sqlx::query_as!(
        Page,
        r#"
        SELECT id, title, content_json, raw_markdown, created_at, updated_at
        FROM pages
        WHERE title ILIKE $1  -- Case-insensitive search for title
        -- For searching in JSONB:
        -- OR content_json::text ILIKE $1
        -- (This is a simple text search in JSON, more advanced JSONB operators can be used)
        ORDER BY updated_at DESC
        "#,
        search_pattern
    )
    .fetch_all(pool)
    .await?;

    Ok(pages)
}
